const STRIPE_API = "https://api.stripe.com/v1"

export class StripeError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "StripeError"
    this.status = status
    this.body = body
  }
}

function stripeSecret() {
  const key = Deno.env.get("STRIPE_SECRET_KEY")?.trim()
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return key
}

export async function stripeRequest<T>(
  method: string,
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const body = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue
      body.append(key, String(value))
    }
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : body,
  })

  const json = await response.json()
  if (!response.ok) {
    const message =
      (json as { error?: { message?: string } }).error?.message ||
      "Stripe request failed"
    throw new StripeError(message, response.status, json)
  }

  return json as T
}

export interface StripeCustomer {
  id: string
  email?: string | null
  name?: string | null
  metadata?: Record<string, string>
}

export interface StripeInvoice {
  id: string
  status: string
  hosted_invoice_url?: string | null
  invoice_pdf?: string | null
  currency: string
  amount_due: number
  amount_paid: number
  customer: string
  metadata?: Record<string, string>
  paid?: boolean
}

export interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
) {
  if (!secret) return { ok: false as const, error: "STRIPE_WEBHOOK_SECRET is not configured" }
  if (!header) return { ok: false as const, error: "Missing Stripe-Signature header" }

  const pairs = header.split(",").map((item) => {
    const [key, ...rest] = item.trim().split("=")
    return [key, rest.join("=")] as const
  })
  const timestamp = pairs.find(([key]) => key === "t")?.[1]
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value)
  if (!timestamp || signatures.length === 0) {
    return { ok: false as const, error: "Invalid Stripe-Signature header" }
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(Number(timestamp)) || ageSeconds > 300) {
    return { ok: false as const, error: "Stripe signature timestamp is too old" }
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  )
  const expected = [...new Uint8Array(signed)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

  if (!signatures.some((signature) => timingSafeEqual(expected, signature))) {
    return { ok: false as const, error: "Invalid Stripe signature" }
  }

  return { ok: true as const }
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}
