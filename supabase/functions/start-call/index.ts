import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import {
  buildSimulatedTranscript,
  initiateOutboundCall,
  isElevenLabsConfigured,
  parseTranscriptSegments,
} from "../_shared/elevenlabs.ts"
import { gradeCallRecord } from "../_shared/grade-call.ts"

interface StartCallBody {
  locationId?: string
  scenarioId?: string
  scorecardId?: string
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

  if (profileError || !profile?.org_id) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  if (!["owner", "admin", "coach", "superadmin"].includes(profile.role)) {
    return jsonResponse({ error: "You do not have permission to start calls." }, 403)
  }

  let body: StartCallBody
  try {
    body = (await req.json()) as StartCallBody
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const locationId = body.locationId?.trim()
  const scenarioId = body.scenarioId?.trim()
  const scorecardId = body.scorecardId?.trim()
  if (!locationId) {
    return jsonResponse({ error: "locationId is required" }, 400)
  }

  const [locationRes, scenarioRes, scorecardRes] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, phone")
      .eq("id", locationId)
      .eq("org_id", profile.org_id)
      .maybeSingle(),
    scenarioId
      ? supabase
          .from("scenarios")
          .select("id, prompt, persona, goals, conversation_rules, approved_at")
          .eq("id", scenarioId)
          .eq("org_id", profile.org_id)
          .maybeSingle()
      : supabase
          .from("scenarios")
          .select("id, prompt, persona, goals, conversation_rules, approved_at")
          .eq("org_id", profile.org_id)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle(),
    scorecardId
      ? supabase
          .from("scorecards")
          .select("id")
          .eq("id", scorecardId)
          .eq("org_id", profile.org_id)
          .maybeSingle()
      : supabase
          .from("scorecards")
          .select("id")
          .eq("org_id", profile.org_id)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle(),
  ])

  if (locationRes.error || !locationRes.data) {
    return jsonResponse({ error: "Location not found" }, 404)
  }

  if (scenarioId && (scenarioRes.error || !scenarioRes.data)) {
    return jsonResponse({ error: "Agent scenario not found" }, 404)
  }

  if (scorecardId && (scorecardRes.error || !scorecardRes.data)) {
    return jsonResponse({ error: "Scorecard not found" }, 404)
  }

  const location = locationRes.data
  const phone = (location.phone as string | null)?.trim()
  if (!phone) {
    return jsonResponse({ error: "Location needs a phone number before calling." }, 400)
  }

  const scenario = scenarioRes.data
  const resolvedScorecardId =
    (scorecardRes.data?.id as string | undefined) ?? null
  const scenarioContext = {
    prompt: (scenario?.prompt as string | undefined) ?? "",
    persona: (scenario?.persona as string | undefined) ?? "",
    goals: (scenario?.goals as string | undefined) ?? "",
    conversationRules: (scenario?.conversation_rules as string | undefined) ?? "",
    locationName: location.name as string,
  }

  const { data: callRow, error: insertError } = await supabase
    .from("calls")
    .insert({
      org_id: profile.org_id,
      location_id: location.id,
      scenario_id: (scenario?.id as string | undefined) ?? null,
      scorecard_id: resolvedScorecardId,
      status: "queued",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (insertError || !callRow) {
    return jsonResponse({ error: insertError?.message ?? "Could not create call." }, 500)
  }

  const callId = callRow.id as string

  if (!isElevenLabsConfigured()) {
    const now = new Date().toISOString()
    const simulatedTranscript = buildSimulatedTranscript(scenarioContext)
    const segments = parseTranscriptSegments(
      simulatedTranscript.split("\n").map((line, index) => {
        const match = line.match(/^([^:]+):\s*(.+)$/)
        if (!match) return null
        return {
          role: match[1].trim(),
          message: match[2].trim(),
          time_in_call_secs: index * 15,
        }
      }).filter(Boolean)
    )

    const { error: simulateError } = await admin
      .from("calls")
      .update({
        status: "analysing",
        started_at: now,
        completed_at: now,
        transcript: simulatedTranscript,
        transcript_json: segments.length > 0 ? { segments } : null,
        notes: "Simulated mystery-shop call ready for grading.",
      })
      .eq("id", callId)

    if (simulateError) {
      return jsonResponse({ error: simulateError.message ?? "Could not simulate call." }, 500)
    }

    await gradeCallRecord(admin, callId)

    const { data: simulated, error: fetchError } = await admin
      .from("calls")
      .select(
        "id, location_id, scenario_id, status, score, notes, started_at, completed_at, created_at, transcript, criterion_scores, external_conversation_id, flag_reasons, flagged_for_review, grader_model, suspected_ai, call_summary, coaching_summary, locations(name)"
      )
      .eq("id", callId)
      .single()

    if (fetchError || !simulated) {
      return jsonResponse({ error: fetchError?.message ?? "Could not simulate call." }, 500)
    }

    return jsonResponse({
      ok: true,
      mode: "simulation",
      call: simulated,
    })
  }

  const outbound = await initiateOutboundCall({
    toNumber: phone,
    callId,
    scenario: scenarioContext,
  })

  if (!outbound.success) {
    await admin
      .from("calls")
      .update({
        status: "failed",
        failure_reason: outbound.error ?? "Could not initiate outbound call.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", callId)

    return jsonResponse({ error: outbound.error ?? "Could not initiate call." }, 502)
  }

  const now = new Date().toISOString()
  const { data: started, error: updateError } = await admin
    .from("calls")
    .update({
      status: "in_progress",
      started_at: now,
      external_conversation_id: outbound.conversationId ?? null,
      external_call_sid: outbound.callSid ?? null,
    })
    .eq("id", callId)
    .select(
      "id, location_id, scenario_id, status, score, notes, started_at, completed_at, created_at, transcript, criterion_scores, external_conversation_id, locations(name)"
    )
    .single()

  if (updateError || !started) {
    return jsonResponse({ error: updateError?.message ?? "Call started but could not save." }, 500)
  }

  return jsonResponse({
    ok: true,
    mode: "live",
    conversationId: outbound.conversationId,
    call: started,
  })
})
