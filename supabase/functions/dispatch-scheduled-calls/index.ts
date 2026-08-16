import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { placeCall } from "../_shared/place-call.ts"
import {
  advanceSchedule,
  localTimeFromDb,
  type CallFrequency,
} from "../_shared/schedule-time.ts"

interface ScheduleRow {
  id: string
  org_id: string
  location_id: string
  scenario_id: string | null
  scorecard_id: string | null
  kind: "recurring" | "one_off"
  status?: "active" | "paused" | "cancelled" | "completed"
  frequency: CallFrequency | null
  timezone: string
  local_time: string
  next_run_at: string
  created_by: string | null
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

async function authorize(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  const cronSecret = Deno.env.get("SCHEDULE_CRON_SECRET")?.trim()
  const headerSecret =
    req.headers.get("x-cron-secret")?.trim() ||
    req.headers.get("x-schedule-secret")?.trim() ||
    ""

  if (cronSecret && headerSecret && timingSafeEqual(headerSecret, cronSecret)) {
    return {
      ok: true as const,
      userId: null as string | null,
      orgId: null as string | null,
    }
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return { ok: false as const, status: 401, error: "Missing authorization" }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle()

  if (
    !profile ||
    !["owner", "admin", "coach", "superadmin"].includes(profile.role)
  ) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have permission to dispatch scheduled calls.",
    }
  }

  return {
    ok: true as const,
    userId: user.id,
    orgId: profile.role === "superadmin"
      ? null
      : (profile.org_id as string | null),
  }
}

async function finishRunNow(
  admin: SupabaseClient,
  schedule: ScheduleRow,
  result: { ok: boolean; status: number; error?: string; call?: Record<string, unknown> },
) {
  const callId = (result.call?.id as string | undefined) ?? null
  const now = new Date().toISOString()
  const permanentFailure = !result.ok && (result.status === 400 || result.status === 404)

  if (schedule.kind === "one_off") {
    await admin
      .from("call_schedules")
      .update({
        status: result.ok ? "completed" : permanentFailure ? "paused" : "active",
        last_run_at: now,
        last_call_id: callId,
        last_error: result.ok ? null : result.error ?? "Call failed",
        claimed_until: null,
      })
      .eq("id", schedule.id)
    return
  }

  await admin
    .from("call_schedules")
    .update({
      last_run_at: now,
      last_call_id: callId,
      last_error: result.ok ? null : result.error ?? "Call failed",
      claimed_until: null,
    })
    .eq("id", schedule.id)
}

async function finishSchedule(
  admin: SupabaseClient,
  schedule: ScheduleRow,
  result: { ok: boolean; status: number; error?: string; call?: Record<string, unknown> },
) {
  const callId = (result.call?.id as string | undefined) ?? null
  const now = new Date()
  const permanentFailure = !result.ok && (result.status === 400 || result.status === 404)

  if (schedule.kind === "one_off") {
    await admin
      .from("call_schedules")
      .update({
        status: result.ok ? "completed" : permanentFailure ? "paused" : "active",
        last_run_at: now.toISOString(),
        last_call_id: callId,
        last_error: result.ok ? null : result.error ?? "Call failed",
        claimed_until: null,
        next_run_at: result.ok || permanentFailure
          ? schedule.next_run_at
          : new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      })
      .eq("id", schedule.id)
    return
  }

  const frequency = schedule.frequency
  if (!frequency) {
    await admin
      .from("call_schedules")
      .update({
        status: "paused",
        last_error: "Recurring schedule is missing a frequency.",
        claimed_until: null,
      })
      .eq("id", schedule.id)
    return
  }

  const dueAt = new Date(schedule.next_run_at)
  let next = advanceSchedule({
    lastDueAt: dueAt,
    localTime: localTimeFromDb(schedule.local_time),
    timeZone: schedule.timezone || "UTC",
    frequency,
  })

  if (next.getTime() <= now.getTime()) {
    next = advanceSchedule({
      lastDueAt: now,
      localTime: localTimeFromDb(schedule.local_time),
      timeZone: schedule.timezone || "UTC",
      frequency,
    })
  }

  await admin
    .from("call_schedules")
    .update({
      status: permanentFailure ? "paused" : "active",
      next_run_at: next.toISOString(),
      last_run_at: now.toISOString(),
      last_call_id: callId,
      last_error: result.ok ? null : result.error ?? "Call failed",
      claimed_until: null,
    })
    .eq("id", schedule.id)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const auth = await authorize(req, supabaseUrl, supabaseAnonKey)
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status)
  }

  let scheduleId: string | null = null
  try {
    const body = (await req.json()) as { scheduleId?: string }
    const raw = body.scheduleId?.trim()
    if (raw) scheduleId = raw
  } catch {
    // Empty body means "run due schedules".
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  if (scheduleId) {
    let query = admin
      .from("call_schedules")
      .select(
        "id, org_id, location_id, scenario_id, scorecard_id, kind, frequency, timezone, local_time, next_run_at, created_by, status",
      )
      .eq("id", scheduleId)
    if (auth.orgId) {
      query = query.eq("org_id", auth.orgId)
    }

    const { data: schedule, error: scheduleError } = await query.maybeSingle()
    if (scheduleError) {
      return jsonResponse({ error: scheduleError.message }, 500)
    }
    if (!schedule) {
      return jsonResponse({ error: "Schedule not found." }, 404)
    }
    if (schedule.status === "cancelled" || schedule.status === "completed") {
      return jsonResponse({ error: "This schedule is no longer active." }, 409)
    }

    const row = schedule as ScheduleRow
    const placed = await placeCall(admin, {
      orgId: row.org_id,
      locationId: row.location_id,
      scenarioId: row.scenario_id,
      scorecardId: row.scorecard_id,
      scheduleId: row.id,
      createdBy: row.created_by ?? auth.userId,
    })

    await finishRunNow(admin, row, placed)

    if (!placed.ok) {
      return jsonResponse({ error: placed.error }, placed.status)
    }

    return jsonResponse({
      ok: true,
      mode: "run_now",
      claimed: 1,
      results: [
        {
          scheduleId: row.id,
          ok: true,
          callId: (placed.call?.id as string | undefined) ?? undefined,
        },
      ],
    })
  }

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_due_call_schedules",
    { p_limit: 10, p_org_id: auth.orgId },
  )

  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500)
  }

  const schedules = (claimed ?? []) as ScheduleRow[]
  const results: Array<{
    scheduleId: string
    ok: boolean
    error?: string
    callId?: string
  }> = []

  for (const schedule of schedules) {
    const placed = await placeCall(admin, {
      orgId: schedule.org_id,
      locationId: schedule.location_id,
      scenarioId: schedule.scenario_id,
      scorecardId: schedule.scorecard_id,
      scheduleId: schedule.id,
      createdBy: schedule.created_by ?? auth.userId,
    })

    await finishSchedule(admin, schedule, placed)

    results.push({
      scheduleId: schedule.id,
      ok: placed.ok,
      error: placed.error,
      callId: (placed.call?.id as string | undefined) ?? undefined,
    })
  }

  return jsonResponse({
    ok: true,
    claimed: schedules.length,
    results,
  })
})
