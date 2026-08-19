import type { CallStatus, OrgCall, CallCriterionScore } from '@/types/org'
import type { ScorecardCriterion } from '@/types/setup'

export const CALLS_LIST_SELECT =
  'id, location_id, scenario_id, scorecard_id, status, score, notes, transcript, recording_url, criterion_scores, failure_reason, failure_metadata, flag_reasons, flagged_for_review, grader_model, human_reviewed, suspected_ai, call_summary, coaching_summary, started_at, completed_at, created_at, locations(name)'

export interface OrgAgentOption {
  id: string
  name: string
  approved: boolean
  isDefault: boolean
}

export interface OrgScorecardOption {
  id: string
  name: string
  isDefault: boolean
  criteria: ScorecardCriterion[]
}

export function mapCriterionScores(raw: unknown): CallCriterionScore[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = item as {
        criterionId?: string
        criterionName?: string
        weight?: number
        score?: number
        confidence?: number
        evidenceQuote?: string | null
        transcriptOffset?: number | null
        source?: 'ai' | 'human'
      }
      return {
        criterionId: row.criterionId ?? '',
        criterionName: row.criterionName ?? '',
        weight: Number(row.weight) || 0,
        score: Number(row.score) || 0,
        confidence:
          row.confidence == null ? undefined : Number(row.confidence),
        evidenceQuote: row.evidenceQuote ?? null,
        transcriptOffset:
          row.transcriptOffset == null
            ? null
            : Number(row.transcriptOffset),
        source: row.source,
      }
    })
    .filter((item) => item.criterionId)
}

export function mapCall(row: Record<string, unknown>): OrgCall {
  const location = row.locations as
    | { name?: string }
    | { name?: string }[]
    | null
  const locationName = Array.isArray(location)
    ? location[0]?.name
    : location?.name

  return {
    id: row.id as string,
    locationId: row.location_id as string,
    locationName: locationName || 'Unknown location',
    scenarioId: (row.scenario_id as string | null) ?? null,
    scorecardId: (row.scorecard_id as string | null) ?? null,
    status: row.status as CallStatus,
    score: row.score == null ? null : Number(row.score),
    notes: (row.notes as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    recordingUrl: (row.recording_url as string | null) ?? null,
    criterionScores: mapCriterionScores(row.criterion_scores),
    failureReason: (row.failure_reason as string | null) ?? null,
    failureMetadata:
      row.failure_metadata &&
      typeof row.failure_metadata === 'object' &&
      !Array.isArray(row.failure_metadata)
        ? (row.failure_metadata as Record<string, unknown>)
        : null,
    flagReasons: Array.isArray(row.flag_reasons)
      ? (row.flag_reasons as string[])
      : [],
    flaggedForReview: Boolean(row.flagged_for_review),
    graderModel: (row.grader_model as string | null) ?? null,
    humanReviewed: Boolean(row.human_reviewed),
    suspectedAi: Boolean(row.suspected_ai),
    callSummary: (row.call_summary as string | null) ?? null,
    coachingSummary: (row.coaching_summary as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export function mapCriteria(raw: unknown): ScorecardCriterion[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as { id?: string; name?: string; weight?: number }
    return {
      id: row.id ?? '',
      name: row.name ?? '',
      weight: Number(row.weight) || 0,
    }
  })
}

export function sortCallsByCreatedAt(calls: OrgCall[]) {
  return [...calls].sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt)
  )
}
