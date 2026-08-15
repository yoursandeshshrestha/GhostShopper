export type SendEmailInput = {
  to: string
  subject: string
  text: string
}

function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Failed to send email via Resend"
  }
  const record = body as Record<string, unknown>
  if (typeof record.message === "string") return record.message
  if (typeof record.error === "string") return record.error
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>
    if (typeof nested.message === "string") return nested.message
  }
  try {
    return JSON.stringify(body)
  } catch {
    return "Failed to send email via Resend"
  }
}

export async function sendResendEmail(input: SendEmailInput): Promise<{
  id: string | null
  error: string | null
}> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  let from =
    Deno.env.get("RESEND_FROM_EMAIL") ?? "GhostShopper <onboarding@resend.dev>"

  // Guard against secrets stored with wrapping quotes or truncated values
  from = from.trim().replace(/^["']|["']$/g, "")
  if (!from || !from.includes("@")) {
    from = "GhostShopper <onboarding@resend.dev>"
  }

  if (!apiKey) {
    return { id: null, error: "RESEND_API_KEY is not configured" }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    return {
      id: null,
      error: readErrorMessage(body),
    }
  }

  return { id: body.id ?? null, error: null }
}
