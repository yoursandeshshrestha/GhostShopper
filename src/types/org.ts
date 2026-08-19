export const INDUSTRIES = [
  'Dental',
  'Home care',
  'Estate agency',
  'Hospitality',
  'Retail',
  'Other',
] as const

export type CallStatus =
  | 'queued'
  | 'in_progress'
  | 'analysing'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'voicemail'
  | 'line_busy'
  | 'short_call'
  | 'cancelled'
  | 'awaiting_review'

export const GENERIC_INITIATION_FAILURE =
  'The call could not be placed. Check the location phone number, Twilio outbound permissions, and ElevenLabs telephony setup.'

export function formatFailureReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase() === 'unknown') {
    return GENERIC_INITIATION_FAILURE
  }
  return trimmed
}

export interface OrgCall {
  id: string
  locationId: string
  locationName: string
  scenarioId: string | null
  scorecardId: string | null
  status: CallStatus
  score: number | null
  notes: string | null
  transcript: string | null
  recordingUrl: string | null
  criterionScores: CallCriterionScore[]
  failureReason: string | null
  failureMetadata: Record<string, unknown> | null
  flagReasons: string[]
  flaggedForReview: boolean
  graderModel: string | null
  humanReviewed: boolean
  suspectedAi: boolean
  callSummary: string | null
  coachingSummary: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface CallCriterionScore {
  criterionId: string
  criterionName: string
  weight: number
  score: number
  confidence?: number
  evidenceQuote?: string | null
  transcriptOffset?: number | null
  source?: 'ai' | 'human'
}

export function formatFlagReason(reason: string): string {
  if (reason === 'suspected_ai_detection') return 'Suspected AI detection'
  if (reason === 'unknown_criteria_in_grade') return 'Unexpected grader output'
  if (reason === 'json_parse_retry_exhausted') return 'Grader output could not be parsed'
  if (reason === 'no_scorecard_criteria') return 'No scorecard criteria configured'
  if (reason.startsWith('grading_failed:')) {
    return `Grading failed: ${reason.slice('grading_failed:'.length)}`
  }
  if (reason.startsWith('low_confidence:')) {
    return `Low confidence: ${reason.slice('low_confidence:'.length)}`
  }
  if (reason.startsWith('critical_fail:')) {
    return `Critical fail: ${reason.slice('critical_fail:'.length)}`
  }
  if (reason.startsWith('missing_grade:')) {
    return `Missing grade: ${reason.slice('missing_grade:'.length)}`
  }
  return reason.replace(/_/g, ' ')
}

export function flagReasonVariant(
  reason: string
): 'destructive' | 'secondary' {
  if (reason === 'suspected_ai_detection') return 'destructive'
  if (reason.startsWith('critical_fail:')) return 'destructive'
  return 'secondary'
}

export function computeWeightedScore(scores: CallCriterionScore[]): number | null {
  if (scores.length === 0) return null
  const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return null
  const weighted = scores.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  )
  return Math.round((weighted / totalWeight) * 100) / 100
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  queued: 'Queued',
  in_progress: 'In progress',
  analysing: 'AI is analysing',
  completed: 'Completed',
  failed: 'Failed',
  missed: 'Missed',
  voicemail: 'Voice mail',
  line_busy: 'Line Busy',
  short_call: 'Short call',
  cancelled: 'Cancelled',
  awaiting_review: 'Awaiting review',
}

export function callStatusVariant(
  status: CallStatus
):
  | 'default'
  | 'secondary'
  | 'success'
  | 'destructive'
  | 'warning'
  | 'outline' {
  if (status === 'awaiting_review') return 'warning'
  if (status === 'analysing') return 'default'
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'secondary'
  if (
    status === 'missed' ||
    status === 'voicemail' ||
    status === 'line_busy' ||
    status === 'short_call' ||
    status === 'cancelled'
  ) {
    return 'destructive'
  }
  if (status === 'in_progress') return 'outline'
  return 'secondary'
}
