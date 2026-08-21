import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  AUDIT_CALL_CAP,
  MIN_DAYS_BETWEEN_CALLS,
  PAST_DUE_PAUSE_DAYS,
  cadenceCallsPerWeek,
  type SubscriptionCadence,
} from "./pricing.ts"

const COUNTED_STATUSES = [
  "queued",
  "in_progress",
  "analysing",
  "completed",
  "awaiting_review",
  "missed",
  "voicemail",
  "line_busy",
  "short_call",
]

export interface BillingGateResult {
  ok: boolean
  status: number
  error?: string
}

interface OrgBillingRow {
  attestation_signed_at: string | null
  subscription_status: "audit" | "active" | "past_due" | "cancelled"
  past_due_since: string | null
  suspended_at: string | null
}

interface SubscriptionRow {
  cadence: SubscriptionCadence
  status: string
}

function daysAgo(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (Date.now() - then) / (24 * 60 * 60 * 1000)
}

export async function assertCallBilling(
  admin: SupabaseClient,
  input: { orgId: string; locationId: string },
): Promise<BillingGateResult> {
  const [orgRes, subRes] = await Promise.all([
    admin
      .from("orgs")
      .select("attestation_signed_at, subscription_status, past_due_since, suspended_at")
      .eq("id", input.orgId)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("cadence, status")
      .eq("org_id", input.orgId)
      .maybeSingle(),
  ])

  if (orgRes.error || !orgRes.data) {
    return { ok: false, status: 404, error: "Organisation not found" }
  }

  const org = orgRes.data as OrgBillingRow
  if (org.suspended_at) {
    return {
      ok: false,
      status: 400,
      error: "This organisation is suspended.",
    }
  }

  if (!org.attestation_signed_at) {
    return {
      ok: false,
      status: 400,
      error: "Legal attestation is required before placing a call.",
    }
  }

  if (org.subscription_status === "cancelled") {
    return {
      ok: false,
      status: 400,
      error: "This organisation no longer has an active subscription.",
    }
  }

  if (org.subscription_status === "past_due") {
    const overdueDays = daysAgo(org.past_due_since)
    if (overdueDays >= PAST_DUE_PAUSE_DAYS) {
      return {
        ok: false,
        status: 400,
        error:
          "New calls are paused because this organisation is more than 7 days past due.",
      }
    }
  }

  if (org.subscription_status === "audit") {
    const { count, error } = await admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("org_id", input.orgId)
      .neq("status", "cancelled")

    if (error) {
      return { ok: false, status: 500, error: error.message }
    }
    if ((count ?? 0) >= AUDIT_CALL_CAP) {
      return {
        ok: false,
        status: 400,
        error:
          "The free audit allows 10 test calls. Start a subscription before placing more.",
      }
    }
  }

  const cadence: SubscriptionCadence =
    (subRes.data as SubscriptionRow | null)?.cadence ?? "weekly"
  const weeklyCap = cadenceCallsPerWeek(cadence)
  const since = new Date(
    Date.now() - MIN_DAYS_BETWEEN_CALLS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [recentRes, weekRes] = await Promise.all([
    admin
      .from("calls")
      .select("id, created_at")
      .eq("org_id", input.orgId)
      .eq("location_id", input.locationId)
      .in("status", COUNTED_STATUSES)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("org_id", input.orgId)
      .eq("location_id", input.locationId)
      .in("status", COUNTED_STATUSES)
      .gte("created_at", weekAgo),
  ])

  if (recentRes.error) {
    return { ok: false, status: 500, error: recentRes.error.message }
  }
  if ((recentRes.data ?? []).length > 0) {
    return {
      ok: false,
      status: 429,
      error: `This location was already called within the last ${MIN_DAYS_BETWEEN_CALLS} days.`,
    }
  }

  if (weekRes.error) {
    return { ok: false, status: 500, error: weekRes.error.message }
  }
  if ((weekRes.count ?? 0) >= weeklyCap) {
    return {
      ok: false,
      status: 429,
      error:
        cadence === "intensive"
          ? "Intensive cadence allows two shops per location each week."
          : "Weekly cadence allows one shop per location each week.",
    }
  }

  return { ok: true, status: 200 }
}
