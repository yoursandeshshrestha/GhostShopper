import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { Webhook } from "npm:standardwebhooks@1"
import { renderEmail } from "../_shared/render.ts"
import { sendMailgunEmail } from "../_shared/mailgun.ts"

/**
 * Supabase Auth Send Email Hook → Mailgun.
 * Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 * Deploy with: supabase functions deploy auth-send-email --no-verify-jwt
 */

type AuthEmailAction = string

const TEMPLATE_BY_ACTION: Record<string, string> = {
  signup: "signup",
  invite: "auth-invite",
  // Supabase has used both names for magic-link emails
  magiclink: "magic-link",
  magic_link: "magic-link",
  login: "magic-link",
  recovery: "recovery",
  email_change: "email-change",
  email_change_new: "email-change",
  email_change_current: "email-change",
}

function appUrl(): string {
  return (Deno.env.get("APP_URL")?.trim() || "https://app.ghostshopper.ai").replace(
    /\/$/,
    ""
  )
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

/** Never put localhost into production magic-link emails. */
function resolveRedirectTo(redirectTo: string): string {
  const fallback = `${appUrl()}/auth/callback`
  if (!redirectTo.trim()) return fallback
  try {
    const url = new URL(redirectTo)
    if (isLocalHost(url.hostname)) return fallback
    return redirectTo
  } catch {
    return fallback
  }
}

function buildActionUrl(input: {
  supabaseUrl: string
  tokenHash: string
  emailActionType: string
  redirectTo: string
}) {
  // Same URL shape as the official Auth Send Email hook examples
  return `${input.supabaseUrl}/auth/v1/verify?token=${input.tokenHash}&type=${input.emailActionType}&redirect_to=${encodeURIComponent(input.redirectTo)}`
}

function jsonError(
  status: number,
  message: string,
  httpCode?: unknown
) {
  return new Response(
    JSON.stringify({
      error: {
        http_code: httpCode ?? status,
        message,
      },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  )
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 })
  }

  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET")
  if (!hookSecretRaw) {
    return jsonError(500, "SEND_EMAIL_HOOK_SECRET is not configured")
  }

  // Docs: strip the `v1,whsec_` prefix before verifying
  const hookSecret = hookSecretRaw.replace("v1,whsec_", "")
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)

  let user: { email: string }
  let email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: AuthEmailAction
    site_url: string
    token_new: string
    token_hash_new: string
  }

  try {
    const verified = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: typeof email_data
    }
    user = verified.user
    email_data = verified.email_data
  } catch (error) {
    console.error("auth-send-email webhook verify failed", error)
    // 401 here is what GoTrue surfaces as "Hook requires authorization token"
    return jsonError(
      401,
      error instanceof Error ? error.message : "Webhook verification failed"
    )
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? email_data.site_url
    const actionType = email_data.email_action_type
    const templateName = TEMPLATE_BY_ACTION[actionType] ?? "magic-link"
    const redirectTo = resolveRedirectTo(email_data.redirect_to ?? "")
    const actionUrl = buildActionUrl({
      supabaseUrl,
      tokenHash: email_data.token_hash,
      emailActionType: actionType,
      redirectTo,
    })

    const content = renderEmail(templateName, {
      email: user.email,
      actionUrl,
      redirectTo,
      siteUrl: appUrl(),
    })

    const result = await sendMailgunEmail({
      to: user.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    })

    if (result.error) {
      console.error("auth-send-email mailgun failed", result.error)
      // Do NOT return 401 for provider failures — Auth mislabels that.
      return jsonError(500, result.error)
    }
  } catch (error) {
    console.error("auth-send-email send failed", error)
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to send email"
    )
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
