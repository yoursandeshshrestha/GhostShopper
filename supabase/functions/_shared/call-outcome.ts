export const NON_SHOP_STATUSES = [
  "failed",
  "missed",
  "voicemail",
  "line_busy",
  "short_call",
] as const

export type NonShopStatus = (typeof NON_SHOP_STATUSES)[number]

export type ConnectedCallOutcome = {
  status: "analysing" | "in_progress" | NonShopStatus
  needsGrading: boolean
  failure_reason: string | null
}

export function isNonShopStatus(
  status: string | null | undefined
): status is NonShopStatus {
  return (NON_SHOP_STATUSES as readonly string[]).includes(status ?? "")
}

const SHORT_CALL_SECS = 20
const MIN_STAFF_CHARS = 40
const MIN_STAFF_TURNS = 2

const VOICEMAIL_RE =
  /voice\s*mail|voicemail|leave (a |your )?message|after the (beep|tone)|mailbox|answering machine|record your message|not available (right now|to take)|unable to (take|answer)|please leave|at the tone|the person you (have )?called|inbox is full/

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function sipStatusFromMetadata(metadata: unknown): string | number | null {
  if (!metadata || typeof metadata !== "object") return null
  const body = (metadata as { body?: Record<string, unknown> }).body
  if (!body) return null
  return (
    numberOrNull(body.sip_status_code) ??
    numberOrNull(body.status_code) ??
    (typeof body.sip_status === "string" ? body.sip_status : null)
  )
}

export function durationFromMetadata(
  metadata: unknown,
  segments?: { t?: number }[]
): number | null {
  if (metadata && typeof metadata === "object") {
    const row = metadata as Record<string, unknown>
    const fromMeta =
      numberOrNull(row.call_duration_secs) ??
      numberOrNull(row.call_duration) ??
      numberOrNull(row.duration_secs)
    if (fromMeta != null) return fromMeta
  }
  if (segments && segments.length > 0) {
    const last = segments[segments.length - 1]?.t
    return typeof last === "number" ? last : null
  }
  return null
}

export function classifyInitiationFailure(
  reason: string | null | undefined,
  sipStatus?: string | number | null
): { status: NonShopStatus; failure_reason: string } {
  const text = `${reason ?? ""} ${sipStatus ?? ""}`.toLowerCase()

  if (/\bbusy\b|\b486\b/.test(text)) {
    return {
      status: "line_busy",
      failure_reason: "The line was busy.",
    }
  }

  if (/no[-_ ]?answer|\b480\b|\b408\b|\b487\b/.test(text)) {
    return {
      status: "missed",
      failure_reason: "No answer.",
    }
  }

  return {
    status: "failed",
    failure_reason: reason?.trim() || "Call initiation failed.",
  }
}

function staffSpeech(segments: { speaker: string; text: string }[]) {
  const staff = segments.filter((segment) => {
    const speaker = segment.speaker.toLowerCase()
    return speaker === "staff" || speaker === "user"
  })
  const text = staff
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  return { turns: staff.length, chars: text.length }
}

export function classifyConnectedCall(input: {
  conversationStatus?: string | null
  durationSecs?: number | null
  terminationReason?: string | null
  transcript?: string | null
  segments?: { speaker: string; text: string }[]
}): ConnectedCallOutcome {
  const conversationStatus = input.conversationStatus ?? "done"

  if (conversationStatus === "processing" || conversationStatus === "in-progress") {
    return {
      status: "in_progress",
      needsGrading: false,
      failure_reason: null,
    }
  }

  if (conversationStatus !== "done") {
    const initiation = classifyInitiationFailure(
      input.terminationReason ?? `Conversation status: ${conversationStatus}`
    )
    if (initiation.status !== "failed") {
      return { ...initiation, needsGrading: false }
    }
    return {
      status: "failed",
      needsGrading: false,
      failure_reason: initiation.failure_reason,
    }
  }

  const segments = input.segments ?? []
  const haystack = `${input.transcript ?? ""}\n${input.terminationReason ?? ""}`.toLowerCase()
  const { turns: staffTurns, chars: staffChars } = staffSpeech(segments)
  const duration = input.durationSecs
  const hasStaffConversation =
    staffTurns >= MIN_STAFF_TURNS || staffChars >= MIN_STAFF_CHARS

  if (VOICEMAIL_RE.test(haystack)) {
    return {
      status: "voicemail",
      needsGrading: false,
      failure_reason: "Reached voice mail.",
    }
  }

  if (!hasStaffConversation) {
    if (duration != null && duration < SHORT_CALL_SECS) {
      return {
        status: "short_call",
        needsGrading: false,
        failure_reason: "The call ended too quickly to grade.",
      }
    }
    return {
      status: "voicemail",
      needsGrading: false,
      failure_reason: "Reached voice mail.",
    }
  }

  if (duration != null && duration < 15 && staffChars < 80) {
    return {
      status: "short_call",
      needsGrading: false,
      failure_reason: "The call ended too quickly to grade.",
    }
  }

  return {
    status: "analysing",
    needsGrading: true,
    failure_reason: null,
  }
}
