import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const DEFAULT_MODEL = "google/gemini-2.5-flash"
const CACHE_MS = 30_000

let cache: {
  scenarioModel: string
  gradingModel: string
  loadedAt: number
} | null = null

function fallbackModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL
}

function normalizeModel(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed || fallbackModel()
}

export interface PlatformAiSettings {
  scenarioModel: string
  gradingModel: string
}

function adminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function loadPlatformAiSettings(): Promise<PlatformAiSettings> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) {
    return {
      scenarioModel: cache.scenarioModel,
      gradingModel: cache.gradingModel,
    }
  }

  const fallback = fallbackModel()
  const admin = adminClient()
  if (!admin) {
    return { scenarioModel: fallback, gradingModel: fallback }
  }

  const { data, error } = await admin
    .from("platform_ai_settings")
    .select("scenario_model, grading_model")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("loadPlatformAiSettings failed", error.message)
    return { scenarioModel: fallback, gradingModel: fallback }
  }

  const scenarioModel = normalizeModel(data?.scenario_model as string | undefined)
  const gradingModel = normalizeModel(data?.grading_model as string | undefined)

  cache = { scenarioModel, gradingModel, loadedAt: Date.now() }
  return { scenarioModel, gradingModel }
}

export async function getScenarioModel(): Promise<string> {
  const settings = await loadPlatformAiSettings()
  return settings.scenarioModel
}

export async function getGradingModel(): Promise<string> {
  const settings = await loadPlatformAiSettings()
  return settings.gradingModel
}
