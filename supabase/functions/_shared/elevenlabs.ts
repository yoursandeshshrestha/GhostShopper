import {
  classifyConnectedCall,
  classifyInitiationFailure,
  durationFromMetadata,
} from "./call-outcome.ts"
import { buildAsrKeywords } from "./asr-keywords.ts"
import { DEFAULT_CALLER_SYSTEM_PROMPT } from "./default-ai-prompts.ts"
import { getCallerSystemPrompt } from "./platform-ai-settings.ts"

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
  organisationName?: string
  industry?: string | null
}

export interface ElevenLabsVoice {
  voiceId: string
  name: string
  previewUrl: string | null
  labels: Record<string, string>
  category: string | null
  description: string | null
  languages: string[]
}

function buildAgentPrompt(
  scenario: ScenarioContext,
  callerSystemPrompt: string
) {
  const behaviour = callerSystemPrompt.trim() || DEFAULT_CALLER_SYSTEM_PROMPT
  const context = [
    [
      "# TARGET BUSINESS",
      scenario.organisationName?.trim()
        ? `Organisation: ${scenario.organisationName.trim()}`
        : "",
      scenario.locationName.trim()
        ? `Location you called: ${scenario.locationName.trim()}`
        : "",
      scenario.industry?.trim() ? `Industry: ${scenario.industry.trim()}` : "",
      "Treat the organisation and location names above as ground truth. Do not invent a different brand.",
    ]
      .filter(Boolean)
      .join("\n"),
    scenario.prompt.trim()
      ? `# SCENARIO\n${scenario.prompt.trim()}`
      : "# SCENARIO\nMake a natural customer enquiry.",
    scenario.persona.trim() ? `# PERSONA\n${scenario.persona.trim()}` : "",
    scenario.goals.trim() ? `# GOALS\n${scenario.goals.trim()}` : "",
    scenario.conversationRules.trim()
      ? `# SCENARIO-SPECIFIC RULES\n${scenario.conversationRules.trim()}`
      : "",
  ].filter(Boolean)

  return `${behaviour}\n\n${context.join("\n\n")}`
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

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  )
}

export async function fetchElevenLabsVoices(): Promise<
  { voices: ElevenLabsVoice[] } | { error: string }
> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  if (!apiKey) return { error: "ElevenLabs is not configured." }

  const response = await fetch(`${ELEVENLABS_API}/voices`, {
    headers: { "xi-api-key": apiKey },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (payload as { detail?: { message?: string } | string }).detail
    const detail =
      typeof message === "string"
        ? message
        : message?.message ?? `ElevenLabs returned ${response.status}`
    return { error: detail }
  }

  const rows = (payload as { voices?: Array<Record<string, unknown>> }).voices ?? []
  return {
    voices: rows
      .map((row) => {
        const voiceId = (row.voice_id as string | undefined)?.trim()
        const name = (row.name as string | undefined)?.trim()
        if (!voiceId || !name) return null
        const labels = asStringRecord(row.labels)
        const verified = Array.isArray(row.verified_languages)
          ? (row.verified_languages as Array<{ language?: string }>)
              .map((item) => item.language?.trim())
              .filter((code): code is string => Boolean(code))
          : []
        const languages = [
          ...new Set(
            [labels.language, ...verified].filter((code): code is string =>
              Boolean(code)
            )
          ),
        ]
        return {
          voiceId,
          name,
          previewUrl: (row.preview_url as string | null | undefined) ?? null,
          labels,
          category: (row.category as string | undefined)?.trim() || null,
          description: (row.description as string | undefined)?.trim() || null,
          languages,
        }
      })
      .filter((voice): voice is ElevenLabsVoice => voice !== null),
  }
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
  voiceId?: string | null
}): Promise<OutboundCallResult> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  const agentId = Deno.env.get("ELEVENLABS_AGENT_ID")
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

  const callerSystemPrompt = await getCallerSystemPrompt()
  const agentPrompt = buildAgentPrompt(input.scenario, callerSystemPrompt)
  const asrKeywords = buildAsrKeywords(input.scenario)
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
            first_message: "",
            language: "en",
            prompt: {
              prompt: agentPrompt,
            },
          },
          ...(asrKeywords.length > 0
            ? {
                asr: {
                  keywords: asrKeywords,
                },
              }
            : {}),
          ...(input.voiceId
            ? {
                tts: {
                  voice_id: input.voiceId,
                },
              }
            : {}),
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

async function endViaMonitorSocket(conversationId: string, apiKey: string) {
  const monitorPath = `/v1/convai/conversations/${conversationId}/monitor`
  const command = JSON.stringify({ command_type: "end_call" })

  type WsStreamCtor = new (
    url: string,
    options?: { headers?: Record<string, string> }
  ) => {
    opened: Promise<{ writable: WritableStream<string> }>
    close: () => void
  }

  const Stream = (globalThis as { WebSocketStream?: WsStreamCtor }).WebSocketStream
  if (typeof Stream === "function") {
    const stream = new Stream(`wss://api.elevenlabs.io${monitorPath}`, {
      headers: { "xi-api-key": apiKey },
    })
    const { writable } = await stream.opened
    const writer = writable.getWriter()
    await writer.write(command)
    await writer.close().catch(() => undefined)
    stream.close()
    return { ok: true as const }
  }

  return await new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
    let settled = false
    let ws: WebSocket | undefined

    const finish = (result: { ok: true } | { ok: false; error: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws?.close()
      } catch {
        // already closed
      }
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({ ok: false, error: "Timed out while ending the live call." })
    }, 8000)

    try {
      // Edge WebSocket() only accepts a protocol string, not headers.
      ws = new WebSocket(
        `wss://api.elevenlabs.io${monitorPath}?xi-api-key=${encodeURIComponent(apiKey)}`
      )
    } catch (error) {
      finish({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not open a connection to the live call.",
      })
      return
    }

    ws.onopen = () => {
      ws?.send(command)
      setTimeout(() => finish({ ok: true }), 400)
    }
    ws.onerror = () => {
      finish({
        ok: false,
        error:
          "Could not hang up the live call. Enable Monitoring on the ElevenLabs agent (Advanced), then try again.",
      })
    }
  })
}

/** Hang up a live ElevenLabs conversation (Twilio / SIP outbound). */
export async function endOutboundConversation(conversationId: string) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")
  if (!apiKey) return { ok: false, error: "ElevenLabs is not configured." }

  const rest = await fetch(
    `${ELEVENLABS_API}/convai/conversations/${conversationId}/end`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
    }
  )
  if (rest.ok) return { ok: true }

  try {
    return await endViaMonitorSocket(conversationId, apiKey)
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not hang up the live call.",
    }
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
    `user: Thanks for calling ${scenario.locationName}. How can I help?`,
    "agent: Hi, I'd like to ask about booking an appointment.",
    "user: Sure, what day were you thinking?",
    "agent: Could you tell me your availability this week?",
    "user: We have openings on Tuesday and Thursday afternoon.",
    "agent: Great, and could you share typical pricing?",
    "user: Our standard consultation starts at £80.",
    "agent: Perfect, I'll think it over. Thank you!",
  ].join("\n")
}
