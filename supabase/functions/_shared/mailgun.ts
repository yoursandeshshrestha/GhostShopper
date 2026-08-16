export type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Failed to send email via Mailgun"
  }
  const record = body as Record<string, unknown>
  if (typeof record.message === "string") return record.message
  if (typeof record.error === "string") return record.error
  try {
    return JSON.stringify(body)
  } catch {
    return "Failed to send email via Mailgun"
  }
}

function domainFromAddress(from: string): string | null {
  const match = from.match(/<([^>]+)>/)
  const email = (match?.[1] ?? from).trim()
  const at = email.lastIndexOf("@")
  if (at === -1) return null
  return email.slice(at + 1)
}

export async function sendMailgunEmail(input: SendEmailInput): Promise<{
  id: string | null
  error: string | null
}> {
  const apiKey = Deno.env.get("MAILGUN_API_KEY")
  let from =
    Deno.env.get("MAILGUN_FROM_EMAIL") ??
    "GhostShopper <noreply@mail.ghostshopper.ai>"

  from = from.trim().replace(/^["']|["']$/g, "")
  if (!from || !from.includes("@")) {
    from = "GhostShopper <noreply@mail.ghostshopper.ai>"
  }

  const domain =
    Deno.env.get("MAILGUN_DOMAIN")?.trim() ||
    domainFromAddress(from) ||
    "mail.ghostshopper.ai"
  const apiBase = (
    Deno.env.get("MAILGUN_API_BASE") ?? "https://api.mailgun.net"
  ).replace(/\/$/, "")

  if (!apiKey) {
    return { id: null, error: "MAILGUN_API_KEY is not configured" }
  }

  const response = await fetch(`${apiBase}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
    },
    body: new URLSearchParams({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    return {
      id: null,
      error: readErrorMessage(body),
    }
  }

  return {
    id: typeof body.id === "string" ? body.id : null,
    error: null,
  }
}
