import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  buildSimulatedTranscript,
  initiateOutboundCall,
  isElevenLabsConfigured,
  parseTranscriptSegments,
} from "./elevenlabs.ts"
import { classifyInitiationFailure } from "./call-outcome.ts"
import { gradeCallRecord } from "./grade-call.ts"

const CALL_SELECT =
  "id, location_id, scenario_id, scorecard_id, schedule_id, status, score, notes, started_at, completed_at, created_at, transcript, criterion_scores, external_conversation_id, flag_reasons, flagged_for_review, grader_model, suspected_ai, call_summary, coaching_summary, locations(name)"

export interface PlaceCallInput {
  orgId: string
  locationId: string
  scenarioId?: string | null
  scorecardId?: string | null
  scheduleId?: string | null
  createdBy?: string | null
}

export interface PlaceCallResult {
  ok: boolean
  status: number
  error?: string
  mode?: "simulation" | "live"
  conversationId?: string
  call?: Record<string, unknown>
}

export async function placeCall(
  admin: SupabaseClient,
  input: PlaceCallInput,
): Promise<PlaceCallResult> {
  const [locationRes, scenarioRes, scorecardRes, activeRes] = await Promise.all([
    admin
      .from("locations")
      .select("id, name, phone")
      .eq("id", input.locationId)
      .eq("org_id", input.orgId)
      .maybeSingle(),
    input.scenarioId
      ? admin
        .from("scenarios")
        .select("id, prompt, persona, goals, conversation_rules, approved_at")
        .eq("id", input.scenarioId)
        .eq("org_id", input.orgId)
        .maybeSingle()
      : admin
        .from("scenarios")
        .select("id, prompt, persona, goals, conversation_rules, approved_at")
        .eq("org_id", input.orgId)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle(),
    input.scorecardId
      ? admin
        .from("scorecards")
        .select("id")
        .eq("id", input.scorecardId)
        .eq("org_id", input.orgId)
        .maybeSingle()
      : admin
        .from("scorecards")
        .select("id")
        .eq("org_id", input.orgId)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle(),
    admin
      .from("calls")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("location_id", input.locationId)
      .in("status", ["queued", "in_progress", "analysing"])
      .limit(1)
      .maybeSingle(),
  ])

  if (locationRes.error || !locationRes.data) {
    return { ok: false, status: 404, error: "Location not found" }
  }

  if (input.scenarioId && (scenarioRes.error || !scenarioRes.data)) {
    return { ok: false, status: 404, error: "Agent scenario not found" }
  }

  if (input.scorecardId && (scorecardRes.error || !scorecardRes.data)) {
    return { ok: false, status: 404, error: "Scorecard not found" }
  }

  if (activeRes.data?.id) {
    return {
      ok: false,
      status: 409,
      error: "This location already has a call in progress.",
    }
  }

  const location = locationRes.data
  const phone = (location.phone as string | null)?.trim()
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Location needs a phone number before calling.",
    }
  }

  const scenario = scenarioRes.data
  const resolvedScorecardId =
    (scorecardRes.data?.id as string | undefined) ?? null
  const scenarioContext = {
    prompt: (scenario?.prompt as string | undefined) ?? "",
    persona: (scenario?.persona as string | undefined) ?? "",
    goals: (scenario?.goals as string | undefined) ?? "",
    conversationRules:
      (scenario?.conversation_rules as string | undefined) ?? "",
    locationName: location.name as string,
  }

  const { data: callRow, error: insertError } = await admin
    .from("calls")
    .insert({
      org_id: input.orgId,
      location_id: location.id,
      scenario_id: (scenario?.id as string | undefined) ?? null,
      scorecard_id: resolvedScorecardId,
      schedule_id: input.scheduleId ?? null,
      status: "queued",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single()

  if (insertError || !callRow) {
    return {
      ok: false,
      status: 500,
      error: insertError?.message ?? "Could not create call.",
    }
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
      }).filter(Boolean),
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
      return {
        ok: false,
        status: 500,
        error: simulateError.message ?? "Could not simulate call.",
      }
    }

    await gradeCallRecord(admin, callId)

    const { data: simulated, error: fetchError } = await admin
      .from("calls")
      .select(CALL_SELECT)
      .eq("id", callId)
      .single()

    if (fetchError || !simulated) {
      return {
        ok: false,
        status: 500,
        error: fetchError?.message ?? "Could not simulate call.",
      }
    }

    return {
      ok: true,
      status: 200,
      mode: "simulation",
      call: simulated as Record<string, unknown>,
    }
  }

  const outbound = await initiateOutboundCall({
    toNumber: phone,
    callId,
    scenario: scenarioContext,
  })

  if (!outbound.success) {
    const outcome = classifyInitiationFailure(
      outbound.error ?? "Could not initiate outbound call."
    )
    await admin
      .from("calls")
      .update({
        status: outcome.status,
        failure_reason: outcome.failure_reason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", callId)

    return {
      ok: false,
      status: 502,
      error: outbound.error ?? "Could not initiate call.",
    }
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
    .select(CALL_SELECT)
    .single()

  if (updateError || !started) {
    return {
      ok: false,
      status: 500,
      error: updateError?.message ?? "Call started but could not save.",
    }
  }

  return {
    ok: true,
    status: 200,
    mode: "live",
    conversationId: outbound.conversationId,
    call: started as Record<string, unknown>,
  }
}
