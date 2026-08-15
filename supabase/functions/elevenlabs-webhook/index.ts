import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { jsonResponse } from "../_shared/cors.ts"
import {
  decodeBase64Audio,
  uploadCallRecording,
} from "../_shared/call-recording.ts"
import { gradeCallRecord } from "../_shared/grade-call.ts"
import {
  formatTranscript,
  parseTranscriptSegments,
  verifyElevenLabsWebhook,
} from "../_shared/elevenlabs.ts"

function extractCallIdFromData(data: Record<string, unknown> | undefined) {
  const clientData = data?.conversation_initiation_client_data as
    | Record<string, unknown>
    | undefined
  const dynamicVariables = clientData?.dynamic_variables as
    | Record<string, unknown>
    | undefined

  const fromDynamic = dynamicVariables?.ghostshopper_call_id
  if (typeof fromDynamic === "string" && fromDynamic.trim()) {
    return fromDynamic.trim()
  }

  return null
}

function extractCallId(event: Record<string, unknown>) {
  const data = event.data as Record<string, unknown> | undefined
  return extractCallIdFromData(data)
}

async function resolveCallId(
  admin: ReturnType<typeof createClient>,
  callId: string | null,
  conversationId: string | undefined
) {
  if (callId) return callId
  if (!conversationId) return null

  const { data } = await admin
    .from("calls")
    .select("id")
    .eq("external_conversation_id", conversationId)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const webhookSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET")

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const rawBody = await req.text()
  const verification = await verifyElevenLabsWebhook(
    rawBody,
    req.headers.get("elevenlabs-signature"),
    webhookSecret
  )

  if (!verification.ok) {
    console.error("ElevenLabs webhook verification failed:", verification.error)
    return jsonResponse({ error: verification.error }, 401)
  }

  const event = verification.event
  const eventType = event.type as string | undefined
  const admin = createClient(supabaseUrl, serviceRoleKey)

  if (eventType === "call_initiation_failure") {
    const data = event.data as Record<string, unknown> | undefined
    const conversationId = data?.conversation_id as string | undefined
    const failureReason =
      (data?.failure_reason as string | undefined) ??
      (data?.reason as string | undefined) ??
      "Call initiation failed."

    const callId = extractCallId(event)
    const now = new Date().toISOString()

    if (callId) {
      await admin
        .from("calls")
        .update({
          status: "failed",
          failure_reason: failureReason,
          completed_at: now,
          external_conversation_id: conversationId ?? null,
        })
        .eq("id", callId)
    } else if (conversationId) {
      await admin
        .from("calls")
        .update({
          status: "failed",
          failure_reason: failureReason,
          completed_at: now,
        })
        .eq("external_conversation_id", conversationId)
    }

    return jsonResponse({ ok: true })
  }

  if (eventType === "post_call_transcription") {
    const data = event.data as Record<string, unknown> | undefined
    const conversationId = data?.conversation_id as string | undefined
    const status = (data?.status as string | undefined) ?? "done"
    const transcript = formatTranscript(data?.transcript)
    const segments = parseTranscriptSegments(data?.transcript)
    const analysis = data?.analysis as Record<string, unknown> | undefined
    const summary =
      (analysis?.transcript_summary as string | undefined) ??
      (analysis?.summary as string | undefined) ??
      null

    const callId = await resolveCallId(
      admin,
      extractCallIdFromData(data) ?? extractCallId(event),
      conversationId
    )
    const now = new Date().toISOString()

    if (!callId) {
      return jsonResponse({ ok: true, ignored: "call_not_found" })
    }

    if (status !== "done") {
      await admin
        .from("calls")
        .update({
          status: "failed",
          completed_at: now,
          transcript: transcript || null,
          transcript_json: segments.length > 0 ? { segments } : null,
          notes: summary,
          external_conversation_id: conversationId ?? null,
          failure_reason: `Conversation status: ${status}`,
        })
        .eq("id", callId)
      return jsonResponse({ ok: true })
    }

    await admin
      .from("calls")
      .update({
        status: "analysing",
        completed_at: now,
        transcript: transcript || null,
        transcript_json: segments.length > 0 ? { segments } : null,
        notes: summary,
        external_conversation_id: conversationId ?? null,
        failure_reason: null,
      })
      .eq("id", callId)

    const gradeResult = await gradeCallRecord(admin, callId)

    return jsonResponse({ ok: true, graded: gradeResult.graded, ...gradeResult })
  }

  if (eventType === "post_call_audio") {
    const data = event.data as Record<string, unknown> | undefined
    const conversationId = data?.conversation_id as string | undefined
    const fullAudio = data?.full_audio as string | undefined

    const callId = await resolveCallId(
      admin,
      extractCallIdFromData(data),
      conversationId
    )

    if (!callId || !fullAudio?.trim()) {
      return jsonResponse({ ok: true, ignored: "call_not_found_or_no_audio" })
    }

    const { data: call } = await admin
      .from("calls")
      .select("org_id, recording_url")
      .eq("id", callId)
      .maybeSingle()

    if (!call?.org_id) {
      return jsonResponse({ ok: true, ignored: "call_not_found" })
    }

    if (call.recording_url) {
      return jsonResponse({ ok: true, ignored: "already_has_recording" })
    }

    try {
      const audio = decodeBase64Audio(fullAudio.trim())
      const path = await uploadCallRecording(
        admin,
        call.org_id as string,
        callId,
        audio
      )
      return jsonResponse({ ok: true, recordingPath: path })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to store recording"
      console.error("Failed to store call recording:", message)
      return jsonResponse({ error: message }, 500)
    }
  }

  return jsonResponse({ ok: true, ignored: eventType ?? "unknown" })
})
