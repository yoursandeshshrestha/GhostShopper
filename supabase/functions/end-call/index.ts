import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { applyCallScheduleOutcome } from "../_shared/schedule-outcome.ts"
import { endOutboundConversation } from "../_shared/elevenlabs.ts"

const CALL_SELECT =
  "id, location_id, scenario_id, scorecard_id, schedule_id, status, score, notes, started_at, completed_at, created_at, transcript, recording_url, criterion_scores, external_conversation_id, failure_reason, flag_reasons, flagged_for_review, grader_model, human_reviewed, suspected_ai, call_summary, coaching_summary, locations(name)"

interface EndCallBody {
  callId?: string
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  if (!["owner", "admin", "coach", "superadmin"].includes(profile.role)) {
    return jsonResponse({ error: "You do not have permission to end calls." }, 403)
  }

  let body: EndCallBody
  try {
    body = (await req.json()) as EndCallBody
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const callId = body.callId?.trim()
  if (!callId) {
    return jsonResponse({ error: "callId is required" }, 400)
  }

  let query = admin
    .from("calls")
    .select(
      "id, org_id, status, external_conversation_id, transcript, notes"
    )
    .eq("id", callId)

  if (profile.role !== "superadmin") {
    if (!profile.org_id) {
      return jsonResponse({ error: "Profile not found" }, 403)
    }
    query = query.eq("org_id", profile.org_id)
  }

  const { data: call, error: callError } = await query.maybeSingle()

  if (callError || !call) {
    return jsonResponse({ error: "Call not found" }, 404)
  }

  const status = call.status as string
  if (status !== "queued" && status !== "in_progress") {
    return jsonResponse({ error: "That call is no longer in progress." }, 409)
  }

  const conversationId = call.external_conversation_id as string | null
  if (conversationId) {
    const ended = await endOutboundConversation(conversationId)
    if (!ended.ok) {
      return jsonResponse(
        { error: ended.error ?? "Could not hang up the live call." },
        502
      )
    }
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await admin
    .from("calls")
    .update({
      status: "cancelled",
      completed_at: now,
      failure_reason: "Call ended from GhostShopper.",
    })
    .eq("id", callId)
    .in("status", ["queued", "in_progress"])
    .select(CALL_SELECT)
    .maybeSingle()

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500)
  }

  if (!updated) {
    return jsonResponse({ error: "That call is no longer in progress." }, 409)
  }

  await applyCallScheduleOutcome(admin, callId)

  return jsonResponse({ ok: true, call: updated })
})
