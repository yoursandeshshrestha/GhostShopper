const DEFAULT_MODEL = "google/gemini-2.5-flash"
const ROUTING_ERROR_RE =
  /no endpoints found that can handle the requested parameters/i

export function llmModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL
}

export function llmApiKey(): string | undefined {
  return Deno.env.get("OPENROUTER_API_KEY")
}

export interface LlmCompletionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number | null
}

type JsonMode = "json_schema" | "json_object" | "prompt"

interface OpenRouterChatPayload {
  error?: { message?: string }
  model?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    cost?: number
  }
}

function usageFromPayload(
  usagePayload: OpenRouterChatPayload["usage"]
): LlmCompletionUsage | null {
  if (!usagePayload) return null
  return {
    promptTokens: Number(usagePayload.prompt_tokens) || 0,
    completionTokens: Number(usagePayload.completion_tokens) || 0,
    totalTokens:
      Number(usagePayload.total_tokens) ||
      (Number(usagePayload.prompt_tokens) || 0) +
        (Number(usagePayload.completion_tokens) || 0),
    costUsd:
      typeof usagePayload.cost === "number" && Number.isFinite(usagePayload.cost)
        ? usagePayload.cost
        : null,
  }
}

function contentFromPayload(payload: OpenRouterChatPayload): string {
  const raw = payload.choices?.[0]?.message?.content
  if (!raw) {
    throw new Error("Model returned no content")
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (fenced?.[1] ?? raw).trim()
}

function requestBody(
  opts: {
    schemaName: string
    schema: Record<string, unknown>
    prompt: string
    maxTokens: number
  },
  model: string,
  mode: JsonMode,
  includeTemperature: boolean
): Record<string, unknown> {
  const prompt =
    mode === "prompt"
      ? `${opts.prompt}\n\nReturn only valid JSON that matches this schema:\n${JSON.stringify(opts.schema)}`
      : opts.prompt

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens,
    messages: [{ role: "user", content: prompt }],
  }

  // Claude Sonnet 5 (and some other reasoning models) reject temperature.
  // OpenRouter ignores unsupported params unless require_parameters is set.
  if (includeTemperature) body.temperature = 0.2

  if (mode === "json_schema") {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        schema: opts.schema,
      },
    }
  } else if (mode === "json_object") {
    body.response_format = { type: "json_object" }
  }

  return body
}

async function postChatCompletion(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; payload: OpenRouterChatPayload }> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://app.ghostshopper.ai",
      "X-Title": "GhostShopper",
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as OpenRouterChatPayload
  return { ok: response.ok, status: response.status, payload }
}

export async function completeJson(opts: {
  schemaName: string
  schema: Record<string, unknown>
  prompt: string
  maxTokens: number
  model?: string
}): Promise<{ text: string; model: string; usage: LlmCompletionUsage | null }> {
  const apiKey = llmApiKey()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const model = opts.model?.trim() || llmModel()
  const attempts: Array<{ mode: JsonMode; temperature: boolean }> = [
    { mode: "json_schema", temperature: true },
    { mode: "json_schema", temperature: false },
    { mode: "json_object", temperature: false },
    { mode: "prompt", temperature: false },
  ]

  let lastError: Error | null = null
  for (const attempt of attempts) {
    const { ok, status, payload } = await postChatCompletion(
      apiKey,
      requestBody(opts, model, attempt.mode, attempt.temperature)
    )
    const message =
      payload.error?.message ?? `OpenRouter returned ${status}`

    if (ok) {
      return {
        text: contentFromPayload(payload),
        model: payload.model ?? model,
        usage: usageFromPayload(payload.usage),
      }
    }

    lastError = new Error(message)
    if (!ROUTING_ERROR_RE.test(message)) {
      throw lastError
    }
  }

  throw lastError ?? new Error("OpenRouter returned no usable endpoint")
}

/** Parse model JSON output with a lightweight object extraction fallback. */
export function parseModelJson(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("Model returned empty JSON")
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Model JSON was not an object")
    }
    return parsed as Record<string, unknown>
  } catch (firstError) {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(trimmed.slice(start, end + 1))
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Model JSON was not an object")
        }
        return parsed as Record<string, unknown>
      } catch {
        // Fall through to the original parse error.
      }
    }

    const message =
      firstError instanceof Error ? firstError.message : "Invalid JSON from model"
    throw new Error(message)
  }
}
