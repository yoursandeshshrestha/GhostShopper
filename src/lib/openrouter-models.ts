export interface OpenRouterModel {
  id: string
  name: string
  description: string
}

const MODELS_URL = 'https://openrouter.ai/api/v1/models?output_modalities=text'
const CACHE_MS = 60 * 60 * 1000

let cache: { models: OpenRouterModel[]; loadedAt: number } | null = null
let inflight: Promise<OpenRouterModel[]> | null = null

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function mapModel(row: Record<string, unknown>): OpenRouterModel | null {
  const id = asString(row.id)
  if (!id) return null
  return {
    id,
    name: asString(row.name) || id,
    description: asString(row.description),
  }
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(MODELS_URL)
  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}`)
  }
  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown>>
  }
  const models = (payload.data ?? [])
    .map(mapModel)
    .filter((model): model is OpenRouterModel => model !== null)

  const seen = new Set<string>()
  return models.filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

export async function loadOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) {
    return cache.models
  }
  if (!inflight) {
    inflight = fetchOpenRouterModels()
      .then((models) => {
        cache = { models, loadedAt: Date.now() }
        return models
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}
