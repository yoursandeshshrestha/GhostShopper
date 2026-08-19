import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"

export type UsageService = "openrouter" | "elevenlabs"
export type UsageOperation = "voice_call" | "call_grade" | "scenario_gen"

export interface LlmUsageUnits {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  model: string
}

export interface UsageLogContext {
  admin: SupabaseClient
  orgId: string
  resourceId?: string | null
}

let cachedVoiceRate: number | null = null
let cachedVoiceRateAt = 0
const VOICE_RATE_TTL_MS = 60_000

async function voiceUsdPerMinute(admin: SupabaseClient): Promise<number> {
  const now = Date.now()
  if (cachedVoiceRate !== null && now - cachedVoiceRateAt < VOICE_RATE_TTL_MS) {
    return cachedVoiceRate
  }

  const { data } = await admin
    .from("platform_pricing")
    .select("voice_usd_per_minute")
    .eq("id", 1)
    .maybeSingle()

  const rate = Number(data?.voice_usd_per_minute)
  cachedVoiceRate = Number.isFinite(rate) && rate >= 0 ? rate : 0.1
  cachedVoiceRateAt = now
  return cachedVoiceRate
}

function voiceCostUsd(durationSecs: number, ratePerMinute: number): number {
  if (durationSecs <= 0 || ratePerMinute <= 0) return 0
  return Math.round((durationSecs / 60) * ratePerMinute * 1_000_000) / 1_000_000
}

export async function recordUsageEvent(
  admin: SupabaseClient,
  event: {
    orgId: string
    service: UsageService
    operation: UsageOperation
    resourceId?: string | null
    units: Record<string, unknown>
    costUsd: number
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await admin.from("usage_events").insert({
    org_id: event.orgId,
    service: event.service,
    operation: event.operation,
    resource_id: event.resourceId ?? null,
    units: event.units,
    cost_usd: event.costUsd,
    metadata: event.metadata ?? {},
  })

  if (error) {
    console.error("Failed to record usage event:", error.message, event)
  }
}

export async function logVoiceCallUsage(
  ctx: UsageLogContext,
  durationSecs: number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const secs = Math.max(0, Math.round(durationSecs ?? 0))
  const rate = await voiceUsdPerMinute(ctx.admin)
  await recordUsageEvent(ctx.admin, {
    orgId: ctx.orgId,
    service: "elevenlabs",
    operation: "voice_call",
    resourceId: ctx.resourceId,
    units: { duration_secs: secs },
    costUsd: voiceCostUsd(secs, rate),
    metadata,
  })
}

export async function logLlmUsage(
  ctx: UsageLogContext,
  operation: "call_grade" | "scenario_gen",
  usage: LlmUsageUnits,
  costUsd: number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent(ctx.admin, {
    orgId: ctx.orgId,
    service: "openrouter",
    operation,
    resourceId: ctx.resourceId,
    units: usage,
    costUsd: costUsd ?? 0,
    metadata,
  })
}

export async function logMockLlmUsage(
  ctx: UsageLogContext,
  operation: "call_grade" | "scenario_gen",
  model: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordUsageEvent(ctx.admin, {
    orgId: ctx.orgId,
    service: "openrouter",
    operation,
    resourceId: ctx.resourceId,
    units: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      model,
    },
    costUsd: 0,
    metadata: { simulated: true, ...metadata },
  })
}
