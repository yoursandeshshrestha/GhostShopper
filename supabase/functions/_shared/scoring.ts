import { completeJson, llmApiKey, llmModel, parseModelJson } from "./openrouter.ts"
import { DEFAULT_GRADING_SYSTEM_PROMPT } from "./default-ai-prompts.ts"
import { loadPlatformAiSettings } from "./platform-ai-settings.ts"
import {
  logLlmUsage,
  logMockLlmUsage,
  type UsageLogContext,
} from "./usage-events.ts"

export const CONFIDENCE_REVIEW_THRESHOLD = 0.7

export type CriterionKind = "binary" | "scale" | "critical_fail"

export interface Criterion {
  id: string
  label: string
  description: string
  weight: number
  kind: CriterionKind
}

export interface TranscriptSegment {
  t: number
  speaker: string
  text: string
}

export interface GradedItem {
  criterion_id: string
  value: number
  evidence_quote: string | null
  transcript_offset: number | null
  confidence: number
}

export interface GradeResult {
  items: GradedItem[]
  total: number
  suspectedAi: boolean
  suspectedAiQuote: string | null
  suspectedAiOffset: number | null
  flagReasons: string[]
  graderModel: string
  callSummary: string | null
  coachingSummary: string | null
}

function gradingSchema(criteria: Criterion[]) {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterion_id: {
              type: "string",
              enum: criteria.map((c) => c.id),
            },
            value: { type: "number" },
            evidence_quote: { type: ["string", "null"] },
            transcript_offset: { type: ["integer", "null"] },
            confidence: { type: "number" },
          },
          required: [
            "criterion_id",
            "value",
            "evidence_quote",
            "transcript_offset",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
      suspected_ai_detection: {
        type: "object",
        properties: {
          suspected: { type: "boolean" },
          evidence_quote: { type: ["string", "null"] },
          transcript_offset: { type: ["integer", "null"] },
        },
        required: ["suspected", "evidence_quote", "transcript_offset"],
        additionalProperties: false,
      },
      coaching_summary: { type: "string" },
      call_summary: { type: "string" },
    },
    required: ["items", "suspected_ai_detection", "coaching_summary", "call_summary"],
    additionalProperties: false,
  }
}

function gradingPrompt(
  criteria: Criterion[],
  segments: TranscriptSegment[],
  scenarioBrief: string | null,
  systemPrompt: string
): string {
  const transcript = segments
    .map((s) => `[${s.t}s] ${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n")
  const rubric = criteria
    .map(
      (c) =>
        `- id: ${c.id}\n  label: ${c.label}\n  kind: ${c.kind}\n  max points (weight): ${c.weight}\n  what earns the points: ${c.description}`
    )
    .join("\n")
  const instructions = systemPrompt.trim() || DEFAULT_GRADING_SYSTEM_PROMPT

  return `${instructions}

Scorecard:
${rubric}

Scenario brief for the caller: ${scenarioBrief ?? "not recorded"}

Transcript:
${transcript}`
}

function clampAndFlag(
  criteria: Criterion[],
  rawItems: GradedItem[],
  suspected: {
    suspected: boolean
    evidence_quote: string | null
    transcript_offset: number | null
  },
  graderModel: string,
  callSummary: string | null,
  coachingSummary: string | null,
  extraFlags: string[] = []
): GradeResult {
  const byId = new Map(criteria.map((c) => [c.id, c]))
  const flagReasons = [...extraFlags]
  const items: GradedItem[] = []

  for (const criterion of criteria) {
    const raw = rawItems.find((i) => i.criterion_id === criterion.id)
    if (!raw) {
      items.push({
        criterion_id: criterion.id,
        value: 0,
        evidence_quote: null,
        transcript_offset: null,
        confidence: 0,
      })
      flagReasons.push(`missing_grade:${criterion.label}`)
      continue
    }
    const weight = Number(criterion.weight)
    const value = Math.min(Math.max(Number(raw.value) || 0, 0), weight)
    const confidence = Math.min(Math.max(Number(raw.confidence) || 0, 0), 1)
    items.push({ ...raw, value, confidence })
    if (confidence < CONFIDENCE_REVIEW_THRESHOLD) {
      flagReasons.push(`low_confidence:${criterion.label}`)
    }
    if (criterion.kind === "critical_fail" && value < weight) {
      flagReasons.push(`critical_fail:${criterion.label}`)
    }
  }

  const unknown = rawItems.filter((i) => !byId.has(i.criterion_id))
  if (unknown.length > 0) flagReasons.push("unknown_criteria_in_grade")
  if (suspected.suspected) flagReasons.push("suspected_ai_detection")

  return {
    items,
    total: Math.round(items.reduce((a, i) => a + i.value, 0)),
    suspectedAi: suspected.suspected,
    suspectedAiQuote: suspected.evidence_quote,
    suspectedAiOffset: suspected.transcript_offset,
    flagReasons,
    graderModel,
    callSummary,
    coachingSummary,
  }
}

function mockGrade(criteria: Criterion[]): GradeResult {
  const rawItems: GradedItem[] = criteria.map((c) => {
    const weight = Number(c.weight)
    if (c.kind === "scale") {
      return {
        criterion_id: c.id,
        value: Math.round(weight * 0.7),
        evidence_quote: "mock grade: verify against the recording",
        transcript_offset: 0,
        confidence: 0.55,
      }
    }
    return {
      criterion_id: c.id,
      value: weight,
      evidence_quote: null,
      transcript_offset: null,
      confidence: 0.9,
    }
  })

  return clampAndFlag(
    criteria,
    rawItems,
    { suspected: false, evidence_quote: null, transcript_offset: null },
    "dev-mock-grader",
    "The caller asked about services but staff said they were too busy and asked to call back. The caller apologised and tried to end the call politely. Staff then asked the caller to stay on the line and requested a poem.",
    "Staff initially declined the enquiry due to being busy, which is a missed opportunity. When the caller offered to hang up, staff changed tone and asked unrelated questions. Train the team to offer a callback time or take basic details even when busy."
  )
}

async function callOpenRouter(
  criteria: Criterion[],
  segments: TranscriptSegment[],
  scenarioBrief: string | null,
  parseRetried: boolean,
  logContext?: UsageLogContext
): Promise<GradeResult> {
  const settings = await loadPlatformAiSettings()
  const { text, model: usedModel, usage } = await completeJson({
    schemaName: "call_grade",
    schema: gradingSchema(criteria),
    prompt: gradingPrompt(
      criteria,
      segments,
      scenarioBrief,
      settings.gradingSystemPrompt
    ),
    maxTokens: 16000,
    model: settings.gradingModel,
  })

  if (logContext && usage) {
    await logLlmUsage(
      logContext,
      "call_grade",
      {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        model: usedModel,
      },
      usage.costUsd
    )
  }

  try {
    const parsed = parseModelJson(text) as {
      items: GradedItem[]
      suspected_ai_detection: {
        suspected: boolean
        evidence_quote: string | null
        transcript_offset: number | null
      }
      call_summary: string
      coaching_summary: string
    }
    return clampAndFlag(
      criteria,
      parsed.items ?? [],
      parsed.suspected_ai_detection ?? {
        suspected: false,
        evidence_quote: null,
        transcript_offset: null,
      },
      usedModel,
      parsed.call_summary?.trim() || null,
      parsed.coaching_summary?.trim() || null
    )
  } catch {
    if (!parseRetried) {
      return callOpenRouter(
        criteria,
        segments,
        scenarioBrief,
        true,
        logContext
      )
    }
    return clampAndFlag(
      criteria,
      [],
      { suspected: false, evidence_quote: null, transcript_offset: null },
      llmModel(),
      null,
      null,
      ["json_parse_retry_exhausted"]
    )
  }
}

export async function gradeCall(
  criteria: Criterion[],
  segments: TranscriptSegment[],
  scenarioBrief: string | null,
  logContext?: UsageLogContext
): Promise<GradeResult> {
  if (segments.length === 0) {
    throw new Error("Transcript has no segments")
  }
  if (criteria.length === 0) {
    throw new Error("Scorecard has no criteria")
  }

  if (!llmApiKey()) {
    if (logContext) {
      await logMockLlmUsage(logContext, "call_grade", "dev-mock-grader")
    }
    return mockGrade(criteria)
  }

  return callOpenRouter(criteria, segments, scenarioBrief, false, logContext)
}

export function valueToPercentScore(value: number, weight: number): number {
  if (weight <= 0) return 0
  return Math.round((value / weight) * 100)
}

export function mapCriteriaFromJson(raw: unknown): Criterion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      const row = item as {
        id?: string
        name?: string
        label?: string
        description?: string
        weight?: number
        kind?: CriterionKind
      }
      const label = row.label ?? row.name ?? `Criterion ${index + 1}`
      return {
        id: row.id ?? `criterion-${index}`,
        label,
        description: row.description?.trim() || label,
        weight: Number(row.weight) || 0,
        kind: row.kind ?? "scale",
      }
    })
    .filter((c) => c.id && c.weight > 0)
}
