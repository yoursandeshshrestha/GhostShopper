import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import {
  DEFAULT_CALLER_SYSTEM_PROMPT,
  DEFAULT_GRADING_SYSTEM_PROMPT,
  DEFAULT_SCENARIO_SYSTEM_PROMPT,
} from "./default-ai-prompts.ts"

const DEFAULT_MODEL = "google/gemini-2.5-flash"
const CACHE_MS = 5_000

let cache: {
  settings: PlatformAiSettings
  loadedAt: number
} | null = null

function fallbackModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL
}

function normalizeModel(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed || fallbackModel()
}

function normalizePrompt(
  value: string | null | undefined,
  fallback: string
): string {
  const trimmed = value?.trim()
  return trimmed || fallback
}

export interface PlatformAiSettings {
  scenarioModel: string
  gradingModel: string
  callerSystemPrompt: string
  scenarioSystemPrompt: string
  gradingSystemPrompt: string
}

function adminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function loadPlatformAiSettings(): Promise<PlatformAiSettings> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) {
    return cache.settings
  }

  const fallback = fallbackModel()
  const defaults: PlatformAiSettings = {
    scenarioModel: fallback,
    gradingModel: fallback,
    callerSystemPrompt: DEFAULT_CALLER_SYSTEM_PROMPT,
    scenarioSystemPrompt: DEFAULT_SCENARIO_SYSTEM_PROMPT,
    gradingSystemPrompt: DEFAULT_GRADING_SYSTEM_PROMPT,
  }

  const admin = adminClient()
  if (!admin) return defaults

  const { data, error } = await admin
    .from("platform_ai_settings")
    .select(
      "scenario_model, grading_model, caller_system_prompt, scenario_system_prompt, grading_system_prompt"
    )
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("loadPlatformAiSettings failed", error.message)
    return defaults
  }

  const settings: PlatformAiSettings = {
    scenarioModel: normalizeModel(data?.scenario_model as string | undefined),
    gradingModel: normalizeModel(data?.grading_model as string | undefined),
    callerSystemPrompt: normalizePrompt(
      data?.caller_system_prompt as string | undefined,
      DEFAULT_CALLER_SYSTEM_PROMPT
    ),
    scenarioSystemPrompt: normalizePrompt(
      data?.scenario_system_prompt as string | undefined,
      DEFAULT_SCENARIO_SYSTEM_PROMPT
    ),
    gradingSystemPrompt: normalizePrompt(
      data?.grading_system_prompt as string | undefined,
      DEFAULT_GRADING_SYSTEM_PROMPT
    ),
  }

  cache = { settings, loadedAt: Date.now() }
  return settings
}

export async function getScenarioModel(): Promise<string> {
  const settings = await loadPlatformAiSettings()
  return settings.scenarioModel
}

export async function getGradingModel(): Promise<string> {
  const settings = await loadPlatformAiSettings()
  return settings.gradingModel
}

export async function getCallerSystemPrompt(): Promise<string> {
  const settings = await loadPlatformAiSettings()
  return settings.callerSystemPrompt
}
