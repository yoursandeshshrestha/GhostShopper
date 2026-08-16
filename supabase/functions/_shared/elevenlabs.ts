import {
  classifyConnectedCall,
  classifyInitiationFailure,
  durationFromMetadata,
} from "./call-outcome.ts"

const ELEVENLABS_API = "https://api.elevenlabs.io/v1"

export interface OutboundCallResult {
  success: boolean
  message?: string
  conversationId?: string
  callSid?: string
  error?: string
}

export interface ScenarioContext {
  prompt: string
  persona: string
  goals: string
  conversationRules: string
  locationName: string
}

function buildAgentPrompt(scenario: ScenarioContext) {
  const parts = [
    scenario.prompt.trim(),
    scenario.persona.trim() ? `Persona: ${scenario.persona.trim()}` : "",
    scenario.goals.trim() ? `Goals: ${scenario.goals.trim()}` : "",
    scenario.conversationRules.trim()
      ? `Rules:\n${scenario.conversationRules.trim()}`
      : "",
    `You are calling ${scenario.locationName} as a mystery shopper. Stay in character.`,
  ].filter(Boolean)

  return parts.join("\n\n")
}

export function isElevenLabsConfigured() {
  return Boolean(
    Deno.env.get("ELEVENLABS_API_KEY") &&
      Deno.env.get("ELEVENLABS_AGENT_ID") &&
      Deno.env.get("ELEVENLABS_AGENT_PHONE_NUMBER_ID")
  )
}

function formatE164(phone: string) {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return trimmed

  if (trimmed.startsWith("+")) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

function buildFirstMessage(locationName: string) {
  return `Hi, I'm calling ${locationName} to ask about your services. Do you have a moment?`
}

export async function fetchConversation(conversationId: string) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  if (!apiKey) return { error: "ElevenLabs is not configured." }

  const response = await fetch(
    `${ELEVENLABS_API}/convai/conversations/${conversationId}`,
    {
      headers: { "xi-api-key": apiKey },
    }
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (payload as { detail?: string }).detail ??
      `ElevenLabs returned ${response.status}`
    return { error: message }
  }

  return { conversation: payload as Record<string, unknown> }
}

export async function fetchConversationAudio(conversationId: string) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  if (!apiKey) return { error: "ElevenLabs is not configured." }

  const response = await fetch(
    `${ELEVENLABS_API}/convai/conversations/${conversationId}/audio`,
    { headers: { "xi-api-key": apiKey } }
  )

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message =
      (payload as { detail?: string }).detail ??
      `ElevenLabs returned ${response.status}`
    return { error: message }
  }

  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    return { error: "Recording is empty." }
  }

  return { audio }
}

export function mapConversationToCallPatch(conversation: Record<string, unknown>) {
  const status = conversation.status as string | undefined
  const transcript = formatTranscript(conversation.transcript)
  const analysis = conversation.analysis as Record<string, unknown> | undefined
  const summary =
    (analysis?.transcript_summary as string | undefined) ??
    (analysis?.summary as string | undefined) ??
    null
  const metadata = conversation.metadata as Record<string, unknown> | undefined
  const failureReason =
    (metadata?.error as string | undefined) ??
    (metadata?.termination_reason as string | undefined) ??
    null
  const segments = parseTranscriptSegments(conversation.transcript)
  const durationSecs = durationFromMetadata(metadata, segments)

  const now = new Date().toISOString()

  if (status === "done" || status === "processing") {
    const outcome = classifyConnectedCall({
      conversationStatus: status,
      durationSecs,
      terminationReason: failureReason,
      transcript,
      segments,
    })
    const terminal = outcome.status !== "analysing" && outcome.status !== "in_progress"
    return {
      needsGrading: outcome.needsGrading,
      status: outcome.status,
      completed_at: terminal || status === "done" ? now : null,
      transcript: transcript || null,
      transcript_json: segments.length > 0 ? { segments } : null,
      notes: summary,
      failure_reason: outcome.failure_reason,
    }
  }

  if (status === "failed") {
    const outcome = classifyInitiationFailure(failureReason)
    return {
      status: outcome.status,
      completed_at: now,
      transcript: transcript || null,
      notes: summary,
      failure_reason: outcome.failure_reason,
    }
  }

  if (status === "in-progress" || status === "initiated") {
    return {
      status: "in_progress",
      transcript: transcript || null,
    }
  }

  return null
}

export async function initiateOutboundCall(input: {
  toNumber: string
  callId: string
  scenario: ScenarioContext
}): Promise<OutboundCallResult> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  const agentId =
    Deno.env.get("ELEVENLABS_AGENT_ID") ??
    Deno.env.get("VITE_ELEVENLABS_AGENT_ID")
  const agentPhoneNumberId = Deno.env.get("ELEVENLABS_AGENT_PHONE_NUMBER_ID")

  if (!apiKey || !agentId || !agentPhoneNumberId) {
    return { success: false, error: "ElevenLabs is not configured." }
  }

  const provider = Deno.env.get("ELEVENLABS_TELEPHONY_PROVIDER") ?? "twilio"
  const endpoint =
    provider === "sip-trunk"
      ? `${ELEVENLABS_API}/convai/sip-trunk/outbound-call`
      : provider === "exotel"
        ? `${ELEVENLABS_API}/convai/exotel/outbound-call`
        : `${ELEVENLABS_API}/convai/twilio/outbound-call`

  const agentPrompt = buildAgentPrompt(input.scenario)
  const toNumber = formatE164(input.toNumber)

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: toNumber,
      call_recording_enabled: true,
      telephony_call_config: {
        ringing_timeout_secs: 45,
      },
      conversation_initiation_client_data: {
        dynamic_variables: {
          ghostshopper_call_id: input.callId,
          location_name: input.scenario.locationName,
          scenario_prompt: input.scenario.prompt,
          scenario_persona: input.scenario.persona,
          scenario_goals: input.scenario.goals,
          scenario_rules: input.scenario.conversationRules,
        },
        conversation_config_override: {
          agent: {
            first_message: buildFirstMessage(input.scenario.locationName),
            language: "en",
            prompt: {
              prompt: agentPrompt,
            },
          },
        },
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const row = payload as {
      detail?: string | { reason?: string; code?: number }
      message?: string
      reason?: string
    }
    const detailReason =
      typeof row.detail === "object" && row.detail?.reason
        ? row.detail.reason
        : null
    const message =
      detailReason ??
      (typeof row.detail === "string" ? row.detail : null) ??
      row.reason ??
      row.message ??
      `ElevenLabs returned ${response.status}`
    return { success: false, error: message }
  }

  return {
    success: Boolean((payload as { success?: boolean }).success ?? true),
    message: (payload as { message?: string }).message,
    conversationId: (payload as { conversation_id?: string }).conversation_id,
    callSid: (payload as { callSid?: string }).callSid,
  }
}

export interface TranscriptSegmentRow {
  t: number
  speaker: string
  text: string
}

function speakerLabel(role: string | undefined) {
  if (!role) return "unknown"
  if (role === "agent") return "caller"
  if (role === "user") return "staff"
  return role
}

export function parseTranscriptSegments(transcript: unknown): TranscriptSegmentRow[] {
  if (!transcript) return []

  if (
    typeof transcript === "object" &&
    transcript !== null &&
    "segments" in transcript &&
    Array.isArray((transcript as { segments?: unknown }).segments)
  ) {
    return parseTranscriptSegments(
      (transcript as { segments: unknown }).segments
    )
  }

  if (!Array.isArray(transcript)) return []

  return transcript
    .map((turn, index) => {
      const row = turn as {
        role?: string
        message?: string
        text?: string
        time_in_call_secs?: number
        start_time?: number
        timestamp?: number
      }
      const message = (row.message ?? row.text ?? "").trim()
      if (!message) return null
      const t =
        Number(row.time_in_call_secs ?? row.start_time ?? row.timestamp) ||
        index * 15
      return {
        t: Math.max(0, Math.round(t)),
        speaker: speakerLabel(row.role),
        text: message,
      }
    })
    .filter((segment): segment is TranscriptSegmentRow => segment !== null)
}

export function formatTranscript(transcript: unknown): string {
  const segments = parseTranscriptSegments(transcript)
  if (segments.length > 0) {
    return segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n")
  }

  if (!Array.isArray(transcript)) return ""

  return transcript
    .map((turn) => {
      const row = turn as {
        role?: string
        message?: string
        text?: string
      }
      const speaker = speakerLabel(row.role)
      const message = row.message ?? row.text ?? ""
      return `${speaker}: ${message}`.trim()
    })
    .filter(Boolean)
    .join("\n")
}

function parseSignatureHeader(header: string | null) {
  if (!header) return null

  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=")
    if (key && value) acc[key.trim()] = value.trim()
    return acc
  }, {})

  const timestamp = parts.t
  const signature = parts.v0 ?? parts.v1
  if (!timestamp || !signature) return null

  return { timestamp, signature }
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  )
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function verifyElevenLabsWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
) {
  if (!secret) {
    return { ok: false as const, error: "Webhook secret is not configured." }
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) {
    return { ok: false as const, error: "Missing ElevenLabs signature." }
  }

  const timestampSeconds = Number(parsed.timestamp)
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false as const, error: "Invalid webhook timestamp." }
  }

  const ageMs = Math.abs(Date.now() - timestampSeconds * 1000)
  if (ageMs > 30 * 60 * 1000) {
    return { ok: false as const, error: "Webhook timestamp is too old." }
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`
  const expected = await hmacSha256Hex(secret, signedPayload)

  if (expected !== parsed.signature) {
    return { ok: false as const, error: "Invalid webhook signature." }
  }

  try {
    return { ok: true as const, event: JSON.parse(rawBody) as Record<string, unknown> }
  } catch {
    return { ok: false as const, error: "Invalid webhook JSON." }
  }
}

export function buildSimulatedTranscript(scenario: ScenarioContext) {
  return [
    "agent: Hello, I'd like to ask about booking an appointment.",
    `user: Thanks for calling ${scenario.locationName}. How can I help?`,
    "agent: Could you tell me your availability this week?",
    "user: We have openings on Tuesday and Thursday afternoon.",
    "agent: Great, and could you share typical pricing?",
    "user: Our standard consultation starts at £80.",
    "agent: Perfect, I'll think it over. Thank you!",
  ].join("\n")
}
