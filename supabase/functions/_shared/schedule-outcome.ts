import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  advanceSchedule,
  localTimeFromDb,
  retryRunAt,
  type CallFrequency,
} from "./schedule-time.ts"

const RETRY_STATUSES = new Set(["missed", "voicemail", "line_busy"])
const SHOP_STATUSES = new Set([
  "analysing",
  "awaiting_review",
  "completed",
])

interface ScheduleRow {
  id: string
  kind: "recurring" | "one_off"
  status: string
  frequency: CallFrequency | null
  timezone: string
  local_time: string
  next_run_at: string
  last_run_at: string | null
  retry_after_minutes: number | null
  retry_count: number | null
  max_retries: number | null
  last_settled_call_id: string | null
}

function nextCadenceAt(schedule: ScheduleRow, from: Date) {
  const frequency = schedule.frequency
  if (!frequency) return null
  const localTime = localTimeFromDb(schedule.local_time)
  const timeZone = schedule.timezone || "UTC"
  let next = advanceSchedule({
    lastDueAt: from,
    localTime,
    timeZone,
    frequency,
  })
  const now = Date.now()
  if (next.getTime() <= now) {
    next = advanceSchedule({
      lastDueAt: new Date(now),
      localTime,
      timeZone,
      frequency,
    })
  }
  return next
}

async function settleSchedule(
  admin: SupabaseClient,
  schedule: ScheduleRow,
  callId: string,
  patch: Record<string, unknown>,
) {
  await admin
    .from("call_schedules")
    .update({
      ...patch,
      last_settled_call_id: callId,
      claimed_until: null,
    })
    .eq("id", schedule.id)
}

async function completeAfterShop(
  admin: SupabaseClient,
  schedule: ScheduleRow,
  callId: string,
) {
  const from = schedule.last_run_at
    ? new Date(schedule.last_run_at)
    : new Date(schedule.next_run_at)

  if (schedule.kind === "one_off") {
    await settleSchedule(admin, schedule, callId, {
      status: "completed",
      retry_count: 0,
      last_error: null,
    })
    return
  }

  const next = nextCadenceAt(schedule, from)
  if (!next) {
    await settleSchedule(admin, schedule, callId, {
      status: "paused",
      last_error: "Recurring schedule is missing a frequency.",
      retry_count: 0,
    })
    return
  }

  await settleSchedule(admin, schedule, callId, {
    status: "active",
    next_run_at: next.toISOString(),
    retry_count: 0,
    last_error: null,
  })
}

async function finishWithoutRetry(
  admin: SupabaseClient,
  schedule: ScheduleRow,
  callId: string,
  lastError: string,
) {
  if (schedule.kind === "one_off") {
    await settleSchedule(admin, schedule, callId, {
      status: "completed",
      last_error: lastError,
      retry_count: 0,
    })
    return
  }

  const from = schedule.last_run_at
    ? new Date(schedule.last_run_at)
    : new Date(schedule.next_run_at)
  const next = nextCadenceAt(schedule, from)
  if (!next) {
    await settleSchedule(admin, schedule, callId, {
      status: "paused",
      last_error: lastError,
      retry_count: 0,
    })
    return
  }

  await settleSchedule(admin, schedule, callId, {
    status: "active",
    next_run_at: next.toISOString(),
    last_error: lastError,
    retry_count: 0,
  })
}

export async function applyCallScheduleOutcome(
  admin: SupabaseClient,
  callId: string,
) {
  const { data: call, error: callError } = await admin
    .from("calls")
    .select("id, schedule_id, status, failure_reason")
    .eq("id", callId)
    .maybeSingle()

  if (callError) {
    console.error("applyCallScheduleOutcome call lookup failed:", callError.message)
    return
  }
  if (!call?.schedule_id) return

  const status = call.status as string
  if (status === "queued" || status === "in_progress") return

  const { data: schedule, error: scheduleError } = await admin
    .from("call_schedules")
    .select(
      "id, kind, status, frequency, timezone, local_time, next_run_at, last_run_at, retry_after_minutes, retry_count, max_retries, last_settled_call_id",
    )
    .eq("id", call.schedule_id)
    .maybeSingle()

  if (scheduleError) {
    console.error(
      "applyCallScheduleOutcome schedule lookup failed:",
      scheduleError.message,
    )
    return
  }
  if (!schedule) return

  const row = schedule as ScheduleRow
  if (row.status === "cancelled") return
  if (row.last_settled_call_id === callId) return

  const lastError =
    (call.failure_reason as string | null)?.trim() ||
    `Call ended as ${status.replace(/_/g, " ")}.`

  if (SHOP_STATUSES.has(status)) {
    await completeAfterShop(admin, row, callId)
    return
  }

  if (RETRY_STATUSES.has(status)) {
    const delay = row.retry_after_minutes ?? 0
    const maxRetries = row.max_retries ?? 2
    const retryCount = row.retry_count ?? 0
    if (delay > 0 && retryCount < maxRetries) {
      const next = retryRunAt(
        new Date(),
        delay,
        localTimeFromDb(row.local_time),
        row.timezone || "UTC",
      )
      await settleSchedule(admin, row, callId, {
        status: "active",
        next_run_at: next.toISOString(),
        retry_count: retryCount + 1,
        last_error: `${lastError} Retrying in ${delay >= 1440 ? "a day" : `${delay} min`}.`,
      })
      return
    }

    await finishWithoutRetry(admin, row, callId, lastError)
    return
  }

  await finishWithoutRetry(admin, row, callId, lastError)
}
