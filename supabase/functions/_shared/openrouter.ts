const DEFAULT_MODEL = "google/gemini-2.5-flash"

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
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://app.ghostshopper.ai",
      "X-Title": "GhostShopper",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      temperature: 0.2,
      messages: [{ role: "user", content: opts.prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.schemaName,
          strict: true,
          schema: opts.schema,
        },
      },
      provider: {
        require_parameters: true,
      },
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
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

  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? `OpenRouter returned ${response.status}`
    )
  }

  const raw = payload.choices?.[0]?.message?.content
  if (!raw) {
    throw new Error("Model returned no content")
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const text = (fenced?.[1] ?? raw).trim()

  const usagePayload = payload.usage
  const usage: LlmCompletionUsage | null = usagePayload
    ? {
        promptTokens: Number(usagePayload.prompt_tokens) || 0,
        completionTokens: Number(usagePayload.completion_tokens) || 0,
        totalTokens:
          Number(usagePayload.total_tokens) ||
          (Number(usagePayload.prompt_tokens) || 0) +
            (Number(usagePayload.completion_tokens) || 0),
        costUsd:
          typeof usagePayload.cost === "number" &&
          Number.isFinite(usagePayload.cost)
            ? usagePayload.cost
            : null,
      }
    : null

  return { text, model: payload.model ?? model, usage }
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
