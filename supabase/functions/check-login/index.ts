import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { renderEmail } from "../_shared/render.ts"
import { sendMailgunEmail } from "../_shared/mailgun.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function sendSuspendedEmail(email: string) {
  const content = renderEmail("account-suspended", { email })
  await sendMailgunEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  let body: { email?: string }
  try {
    body = (await req.json()) as { email?: string }
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return jsonResponse({ error: "A valid email is required" }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, suspended_at, org_id, role, orgs(suspended_at)")
    .eq("email", email)
    .maybeSingle()

  if (profileError) {
    console.error("check-login profile lookup failed", profileError)
    return jsonResponse({ error: "Could not verify account status" }, 500)
  }

  if (profile) {
    const orgRaw = profile.orgs as
      | { suspended_at: string | null }
      | { suspended_at: string | null }[]
      | null
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw
    const userSuspended = Boolean(profile.suspended_at)
    const orgSuspended = Boolean(org?.suspended_at)

    if (userSuspended || orgSuspended) {
      try {
        await sendSuspendedEmail(email)
      } catch (error) {
        console.error("check-login suspended email failed", error)
      }

      return jsonResponse({
        allowed: false,
        suspended: true,
        reason: userSuspended ? "user" : "org",
      })
    }
  }

  return jsonResponse({ allowed: true, suspended: false })
})
