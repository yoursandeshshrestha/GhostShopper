import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { generateScenarioFields } from "../_shared/scenario-gen.ts"

interface GenerateScenarioBody {
  prompt?: string
  orgId?: string
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
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

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

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  if (!["owner", "admin", "coach", "superadmin"].includes(profile.role)) {
    return jsonResponse({ error: "Not allowed to generate scenarios" }, 403)
  }

  let body: GenerateScenarioBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const orgId =
    profile.role === "superadmin"
      ? body.orgId?.trim() || null
      : (profile.org_id as string | null)

  if (!orgId) {
    return jsonResponse({ error: "Profile not found" }, 403)
  }

  const prompt = body.prompt?.trim() ?? ""
  if (!prompt) {
    return jsonResponse({ error: "prompt is required" }, 400)
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("industry")
    .eq("id", orgId)
    .maybeSingle()

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const generated = await generateScenarioFields(
      prompt,
      (org?.industry as string | null) ?? null,
      { admin, orgId }
    )
    return jsonResponse({
      persona: generated.persona,
      goals: generated.goals,
      conversationRules: generated.conversationRules,
      graderModel: generated.graderModel,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scenario generation failed"
    return jsonResponse({ error: message }, 500)
  }
})
