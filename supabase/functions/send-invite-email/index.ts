import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { renderEmail } from "../_shared/render.ts"
import { sendResendEmail } from "../_shared/resend.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface InviteEmailBody {
  email?: string
  orgName?: string
  role?: string
  inviteUrl?: string
  token?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin"
    case "coach":
      return "Coach"
    case "location_viewer":
      return "Location Viewer"
    default:
      return role
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile?.org_id) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  if (!["owner", "admin", "superadmin"].includes(profile.role)) {
    return jsonResponse({ error: "Only owners and admins can send invites" }, 403)
  }

  let body: InviteEmailBody
  try {
    body = (await req.json()) as InviteEmailBody
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const orgName = body.orgName?.trim()
  const token = body.token?.trim()
  const inviteUrl =
    body.inviteUrl?.trim() ||
    (token ? `${Deno.env.get("APP_URL") ?? ""}/invite/${token}` : "")

  if (!email || !orgName || !token || !inviteUrl) {
    return jsonResponse(
      { error: "email, orgName, token, and inviteUrl are required" },
      400
    )
  }

  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select("id, email, role, token, org_id, accepted_at, expires_at")
    .eq("token", token)
    .eq("org_id", profile.org_id)
    .maybeSingle()

  if (inviteError || !invitation) {
    return jsonResponse({ error: "Invitation not found" }, 404)
  }

  if (invitation.accepted_at) {
    return jsonResponse({ error: "Invitation already accepted" }, 400)
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "Invitation has expired" }, 400)
  }

  if (invitation.email.toLowerCase() !== email) {
    return jsonResponse({ error: "Invitation email mismatch" }, 400)
  }

  const content = renderEmail("team-invite", {
    orgName,
    role: roleLabel(invitation.role),
    inviteUrl,
    email,
  })

  const result = await sendResendEmail({
    to: email,
    subject: content.subject,
    text: content.text,
  })

  if (result.error) {
    return jsonResponse({ error: result.error }, 502)
  }

  return jsonResponse({ ok: true, id: result.id })
})
