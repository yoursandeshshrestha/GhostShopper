import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { uploadCallRecording } from "../_shared/call-recording.ts"
import { gradeCallRecord } from "../_shared/grade-call.ts"
import { applyCallScheduleOutcome } from "../_shared/schedule-outcome.ts"
import {
  fetchConversation,
  fetchConversationAudio,
  mapConversationToCallPatch,
} from "../_shared/elevenlabs.ts"
import { buildFailureMetadata } from "../_shared/failure-debug.ts"

interface SyncCallBody {
  callId?: string
}

const STALE_WITHOUT_CONVERSATION_MS = 10 * 60 * 1000
const STALE_IN_PROGRESS_MS = 5 * 60 * 1000

function callAgeMs(reference: string | null | undefined) {
  if (!reference) return 0
  const when = Date.parse(reference)
  if (!Number.isFinite(when)) return 0
  return Date.now() - when
}

async function finalizeStaleCall(
  admin: ReturnType<typeof createClient>,
  callId: string,
  reason: string,
  debug?: Record<string, unknown>
) {
  const now = new Date().toISOString()
  await admin
    .from("calls")
    .update({
      status: "failed",
      failure_reason: reason,
      failure_metadata: debug ?? null,
      completed_at: now,
    })
    .eq("id", callId)
  await applyCallScheduleOutcome(admin, callId)
}

async function backfillRecording(
  admin: ReturnType<typeof createClient>,
  callId: string,
  orgId: string,
  conversationId: string
) {
  const audioResult = await fetchConversationAudio(conversationId)
  if (!audioResult.audio) return false

  await uploadCallRecording(admin, orgId, callId, audioResult.audio)
  return true
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  let body: SyncCallBody = {}
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as SyncCallBody
    }
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, assigned_location_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.org_id) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  let query = supabase
    .from("calls")
    .select(
      "id, external_conversation_id, status, location_id, ai_graded_at, transcript, created_at, started_at"
    )
    .eq("org_id", profile.org_id)
    .in("status", ["in_progress", "queued", "analysing"])

  if (body.callId?.trim()) {
    query = query.eq("id", body.callId.trim())
  }

  const { data: calls, error: callsError } = await query
  if (callsError) {
    return jsonResponse({ error: callsError.message }, 500)
  }

  const visible = (calls ?? []).filter((call) => {
    if (
      profile.role === "location_viewer" &&
      profile.assigned_location_id &&
      call.location_id !== profile.assigned_location_id
    ) {
      return false
    }
    return true
  })

  const updated: string[] = []
  const graded: string[] = []
  const stale: string[] = []

  for (const call of visible) {
    const callId = call.id as string
    const conversationId = call.external_conversation_id as string | null
    const callStatus = call.status as string
    const referenceTime =
      (call.started_at as string | null) ??
      (call.created_at as string | null)

    if (callStatus === "analysing") {
      if (!call.ai_graded_at && call.transcript) {
        const gradeResult = await gradeCallRecord(admin, callId)
        if (gradeResult.graded) graded.push(callId)
      }
      continue
    }

    if (!conversationId) {
      if (callAgeMs(referenceTime) >= STALE_WITHOUT_CONVERSATION_MS) {
        await finalizeStaleCall(
          admin,
          callId,
          "The outbound call never connected. Start a new call if you still need a shop.",
          buildFailureMetadata({
            source: "sync_call_status",
            rawReason: "no_conversation_id",
            payload: { call_id: callId, stale_after_ms: STALE_WITHOUT_CONVERSATION_MS },
          })
        )
        stale.push(callId)
      }
      continue
    }

    const result = await fetchConversation(conversationId)

    if (result.error || !result.conversation) {
      if (callAgeMs(referenceTime) >= STALE_IN_PROGRESS_MS) {
        await finalizeStaleCall(
          admin,
          callId,
          result.error ??
            "The call timed out before a transcript was received.",
          buildFailureMetadata({
            source: "sync_call_status",
            rawReason: result.error ?? "conversation_fetch_failed",
            conversationId,
            payload: { call_id: callId, conversation_id: conversationId },
          })
        )
        stale.push(callId)
      }
      continue
    }

    const patch = mapConversationToCallPatch(result.conversation)
    if (!patch) {
      if (callAgeMs(referenceTime) >= STALE_IN_PROGRESS_MS) {
        await finalizeStaleCall(
          admin,
          callId,
          "The call ended without a usable transcript.",
          buildFailureMetadata({
            source: "sync_call_status",
            rawReason: "empty_conversation_patch",
            conversationId,
            payload: {
              call_id: callId,
              conversation_id: conversationId,
              conversation: result.conversation,
            },
          })
        )
        stale.push(callId)
      }
      continue
    }

    const { needsGrading, status, ...rest } = patch
    const dbPatch = {
      ...rest,
      ...(status ? { status } : {}),
    }
    const { error: updateError } = await admin
      .from("calls")
      .update(dbPatch)
      .eq("id", callId)

    if (updateError) continue
    updated.push(callId)
    await applyCallScheduleOutcome(admin, callId)

    if (needsGrading && !call.ai_graded_at) {
      const gradeResult = await gradeCallRecord(admin, callId)
      if (gradeResult.graded) {
        graded.push(callId)
      } else {
        await admin
          .from("calls")
          .update({
            status: "awaiting_review",
            flagged_for_review: true,
            flag_reasons: [`sync_grading:${gradeResult.reason ?? "unknown"}`],
            completed_at: rest.completed_at ?? new Date().toISOString(),
          })
          .eq("id", callId)
          .in("status", ["in_progress", "analysing"])
      }
    }
  }

  const { data: pendingGrade } = await admin
    .from("calls")
    .select("id")
    .eq("org_id", profile.org_id)
    .in("status", ["in_progress", "queued", "analysing"])
    .not("transcript", "is", null)
    .is("ai_graded_at", null)

  for (const row of pendingGrade ?? []) {
    const callId = row.id as string
    if (updated.includes(callId) || graded.includes(callId) || stale.includes(callId)) {
      continue
    }
    const gradeResult = await gradeCallRecord(admin, callId)
    if (gradeResult.graded) graded.push(callId)
  }

  const { data: missingRecording } = await admin
    .from("calls")
    .select("id, org_id, external_conversation_id, location_id")
    .eq("org_id", profile.org_id)
    .is("recording_url", null)
    .not("external_conversation_id", "is", null)
    .in("status", [
      "completed",
      "failed",
      "missed",
      "voicemail",
      "line_busy",
      "short_call",
      "awaiting_review",
    ])
    .order("created_at", { ascending: false })
    .limit(5)

  let recordings = 0
  for (const row of missingRecording ?? []) {
    if (
      profile.role === "location_viewer" &&
      profile.assigned_location_id &&
      row.location_id !== profile.assigned_location_id
    ) {
      continue
    }

    try {
      const stored = await backfillRecording(
        admin,
        row.id as string,
        row.org_id as string,
        row.external_conversation_id as string
      )
      if (stored) recordings += 1
    } catch (error) {
      console.error("Recording backfill failed:", row.id, error)
    }
  }

  return jsonResponse({
    ok: true,
    synced: updated.length,
    graded: graded.length,
    stale: stale.length,
    recordings,
    callIds: updated,
  })
})
