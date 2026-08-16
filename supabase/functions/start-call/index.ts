import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { placeCall } from "../_shared/place-call.ts"

interface StartCallBody {
  locationId?: string
  scenarioId?: string
  scorecardId?: string
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const admin = createClient(supabaseUrl, serviceRoleKey)

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

  if (!["owner", "admin", "coach", "superadmin"].includes(profile.role)) {
    return jsonResponse({ error: "You do not have permission to start calls." }, 403)
  }

  let body: StartCallBody
  try {
    body = (await req.json()) as StartCallBody
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const locationId = body.locationId?.trim()
  const scenarioId = body.scenarioId?.trim()
  const scorecardId = body.scorecardId?.trim()
  if (!locationId) {
    return jsonResponse({ error: "locationId is required" }, 400)
  }

  const result = await placeCall(admin, {
    orgId: profile.org_id as string,
    locationId,
    scenarioId: scenarioId || null,
    scorecardId: scorecardId || null,
    createdBy: user.id,
  })

  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status)
  }

  return jsonResponse({
    ok: true,
    mode: result.mode,
    conversationId: result.conversationId,
    call: result.call,
  })
})
