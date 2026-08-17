const DEFAULT_MODEL = "google/gemini-2.5-flash"

export function llmModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL
}

export function llmApiKey(): string | undefined {
  return Deno.env.get("OPENROUTER_API_KEY")
}

export async function completeJson(opts: {
  schemaName: string
  schema: Record<string, unknown>
  prompt: string
  maxTokens: number
}): Promise<{ text: string; model: string }> {
  const apiKey = llmApiKey()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const model = llmModel()
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

  return { text, model: payload.model ?? model }
}
