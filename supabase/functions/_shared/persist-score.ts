import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"

export interface PersistableCriterionScore {
  criterionId: string
  criterionName: string
  weight: number
  score: number
  confidence?: number
  evidenceQuote?: string | null
  transcriptOffset?: number | null
  source?: "ai" | "human"
}

interface PersistScoreInput {
  callId: string
  orgId: string
  scorecardId: string | null
  total: number
  criterionScores: PersistableCriterionScore[]
  graderModel?: string | null
  suspectedAi?: boolean
  humanReviewed?: boolean
  flaggedForReview?: boolean
  flagReasons?: string[]
  callSummary?: string | null
  coachingSummary?: string | null
}

export async function persistCallScore(
  admin: SupabaseClient,
  input: PersistScoreInput
) {
  const { data: scoreRow, error: scoreError } = await admin
    .from("scores")
    .upsert(
      {
        call_id: input.callId,
        org_id: input.orgId,
        scorecard_id: input.scorecardId,
        total: input.total,
        grader_model: input.graderModel ?? null,
        suspected_ai: input.suspectedAi ?? false,
        human_reviewed: input.humanReviewed ?? false,
        flagged_for_review: input.flaggedForReview ?? false,
        flag_reasons: input.flagReasons ?? [],
        call_summary: input.callSummary ?? null,
        coaching_summary: input.coachingSummary ?? null,
      },
      { onConflict: "call_id" }
    )
    .select("id")
    .single()

  if (scoreError || !scoreRow) {
    throw new Error(scoreError?.message ?? "Could not persist score")
  }

  const scoreId = scoreRow.id as string

  await admin.from("score_items").delete().eq("score_id", scoreId)

  if (input.criterionScores.length === 0) return scoreId

  const { error: itemsError } = await admin.from("score_items").insert(
    input.criterionScores.map((item) => ({
      score_id: scoreId,
      criterion_id: item.criterionId,
      criterion_name: item.criterionName,
      weight: item.weight,
      score: item.score,
      confidence: item.confidence ?? null,
      evidence_quote: item.evidenceQuote ?? null,
      transcript_offset: item.transcriptOffset ?? null,
      source: item.source ?? "ai",
    }))
  )

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  return scoreId
}
