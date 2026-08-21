import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { isNonShopStatus } from "./call-outcome.ts"
import { parseTranscriptSegments } from "./elevenlabs.ts"
import { persistCallScore } from "./persist-score.ts"
import { notifyFlaggedCall } from "./notify-flagged-call.ts"
import {
  gradeCall,
  mapCriteriaFromJson,
  valueToPercentScore,
  type TranscriptSegment,
} from "./scoring.ts"

const AUTO_FLAG_BELOW_SCORE = 30

interface GradeCallResult {
  graded: boolean
  reason?: string
  callId?: string
  status?: string
  flagged?: boolean
}

function scenarioBriefFromRow(scenario: Record<string, unknown> | null) {
  if (!scenario) return null
  const prompt = (scenario.prompt as string | undefined)?.trim()
  const persona = (scenario.persona as string | undefined)?.trim()
  const goals = (scenario.goals as string | undefined)?.trim()
  return [prompt, persona && `Persona: ${persona}`, goals && `Goals: ${goals}`]
    .filter(Boolean)
    .join("\n")
}

function buildCriterionScores(
  gradeItems: Awaited<ReturnType<typeof gradeCall>>["items"],
  criteria: ReturnType<typeof mapCriteriaFromJson>
) {
  const byId = new Map(criteria.map((c) => [c.id, c]))
  return gradeItems.map((item) => {
    const criterion = byId.get(item.criterion_id)
    const weight = criterion?.weight ?? 0
    return {
      criterionId: item.criterion_id,
      criterionName: criterion?.label ?? item.criterion_id,
      weight,
      score: valueToPercentScore(item.value, weight),
      confidence: item.confidence,
      evidenceQuote: item.evidence_quote,
      transcriptOffset: item.transcript_offset,
      source: "ai" as const,
    }
  })
}

function computeTotalScore(
  criterionScores: ReturnType<typeof buildCriterionScores>
): number {
  const totalWeight = criterionScores.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return 0
  const weighted = criterionScores.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  )
  return Math.round((weighted / totalWeight) * 100) / 100
}

function segmentsFromCall(
  transcriptJson: unknown,
  transcript: string | null
): TranscriptSegment[] {
  const fromJson = parseTranscriptSegments(transcriptJson)
  if (fromJson.length > 0) return fromJson
  if (!transcript?.trim()) return []
  return parseTranscriptSegments(
    transcript.split("\n").map((line, index) => {
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (!match) return null
      return {
        role: match[1].trim(),
        message: match[2].trim(),
        time_in_call_secs: index * 15,
      }
    }).filter(Boolean)
  )
}

export async function gradeCallRecord(
  admin: SupabaseClient,
  callId: string
): Promise<GradeCallResult> {
  const { data: call, error } = await admin
    .from("calls")
    .select(
      "id, org_id, location_id, scenario_id, scorecard_id, status, transcript, transcript_json, ai_graded_at, notes"
    )
    .eq("id", callId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!call) return { graded: false, reason: "call_not_found" }
  if (call.ai_graded_at) {
    return { graded: false, reason: "already_graded", callId }
  }
  if (isNonShopStatus(call.status as string)) {
    return { graded: false, reason: `status_is_${call.status}` }
  }

  const segments = segmentsFromCall(call.transcript_json, call.transcript)
  if (segments.length === 0) {
    return { graded: false, reason: "no_transcript" }
  }

  if (
    call.status === "queued" ||
    call.status === "in_progress" ||
    call.status === "analysing"
  ) {
    await admin
      .from("calls")
      .update({ status: "analysing" })
      .eq("id", callId)
      .in("status", ["queued", "in_progress", "analysing"])
  }

  const scorecardQuery = call.scorecard_id
    ? admin
        .from("scorecards")
        .select("criteria")
        .eq("id", call.scorecard_id as string)
        .maybeSingle()
    : admin
        .from("scorecards")
        .select("criteria")
        .eq("org_id", call.org_id)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle()

  const [{ data: scorecard }, { data: scenario }] = await Promise.all([
    scorecardQuery,
    call.scenario_id
      ? admin
          .from("scenarios")
          .select("prompt, persona, goals")
          .eq("id", call.scenario_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const criteria = mapCriteriaFromJson(scorecard?.criteria)
  if (criteria.length === 0) {
    const now = new Date().toISOString()
    await admin
      .from("calls")
      .update({
        status: "awaiting_review",
        flagged_for_review: true,
        flag_reasons: ["no_scorecard_criteria"],
        completed_at: now,
        ai_graded_at: now,
      })
      .eq("id", callId)
    await notifyFlaggedCall(admin, {
      orgId: call.org_id as string,
      locationId: call.location_id as string,
      flagReasons: ["no_scorecard_criteria"],
    }).catch((error) => console.error("Flagged-call email failed:", error))
    return {
      graded: true,
      callId,
      status: "awaiting_review",
      flagged: true,
      reason: "no_scorecard_criteria",
    }
  }

  let grade
  try {
    grade = await gradeCall(
      criteria,
      segments,
      scenarioBriefFromRow(scenario as Record<string, unknown> | null),
      {
        admin,
        orgId: call.org_id as string,
        resourceId: callId,
      }
    )
  } catch (gradingError) {
    const message =
      gradingError instanceof Error ? gradingError.message : "Grading failed"
    const now = new Date().toISOString()
    await admin
      .from("calls")
      .update({
        status: "awaiting_review",
        flagged_for_review: true,
        flag_reasons: [`grading_failed:${message}`],
        completed_at: now,
        ai_graded_at: now,
        notes: call.notes ?? `Auto-grading failed: ${message}`,
      })
      .eq("id", callId)
    await notifyFlaggedCall(admin, {
      orgId: call.org_id as string,
      locationId: call.location_id as string,
      flagReasons: [`grading_failed:${message}`],
    }).catch((error) => console.error("Flagged-call email failed:", error))
    return {
      graded: true,
      callId,
      status: "awaiting_review",
      flagged: true,
      reason: message,
    }
  }

  const criterionScores = buildCriterionScores(grade.items, criteria)
  const score = computeTotalScore(criterionScores)
  const flagReasons =
    score < AUTO_FLAG_BELOW_SCORE && !grade.flagReasons.includes("low_score")
      ? [...grade.flagReasons, "low_score"]
      : grade.flagReasons
  const flagged = flagReasons.length > 0
  const now = new Date().toISOString()
  const callSummary = grade.callSummary?.trim() || null
  const coachingSummary = grade.coachingSummary?.trim() || null

  await admin
    .from("calls")
    .update({
      status: "awaiting_review",
      score,
      criterion_scores: criterionScores,
      flag_reasons: flagReasons,
      flagged_for_review: flagged,
      grader_model: grade.graderModel,
      ai_graded_at: now,
      completed_at: now,
      human_reviewed: false,
      suspected_ai: grade.suspectedAi,
      call_summary: callSummary,
      coaching_summary: coachingSummary,
      transcript_json: { segments },
    })
    .eq("id", callId)

  await persistCallScore(admin, {
    callId,
    orgId: call.org_id as string,
    scorecardId: (call.scorecard_id as string | null) ?? null,
    total: score,
    criterionScores,
    graderModel: grade.graderModel,
    suspectedAi: grade.suspectedAi,
    humanReviewed: false,
    flaggedForReview: flagged,
    flagReasons,
    callSummary,
    coachingSummary,
  })

  if (flagged) {
    await notifyFlaggedCall(admin, {
      orgId: call.org_id as string,
      locationId: call.location_id as string,
      flagReasons,
    }).catch((error) => console.error("Flagged-call email failed:", error))
  }

  return {
    graded: true,
    callId,
    status: "awaiting_review",
    flagged,
  }
}
