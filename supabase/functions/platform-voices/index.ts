import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { fetchElevenLabsVoices } from "../_shared/elevenlabs.ts"
import {
  genderFromLabels,
  parseVoiceGender,
  type VoiceGender,
} from "../_shared/voice-pool.ts"

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "superadmin") {
    return jsonResponse({ error: "Superadmin only" }, 403)
  }

  const catalog = await fetchElevenLabsVoices()
  if ("error" in catalog) {
    return jsonResponse({ error: catalog.error }, 502)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: saved, error: savedError } = await admin
    .from("platform_voices")
    .select("elevenlabs_voice_id, gender, enabled")

  if (savedError) {
    return jsonResponse({ error: savedError.message }, 500)
  }

  const byId = new Map(
    (saved ?? []).map((row) => [
      row.elevenlabs_voice_id as string,
      {
        gender: parseVoiceGender(row.gender) ?? "neutral",
        enabled: Boolean(row.enabled),
      },
    ])
  )

  const voices = catalog.voices.map((voice) => {
    const existing = byId.get(voice.voiceId)
    const gender: VoiceGender =
      existing?.gender ?? genderFromLabels(voice.labels)
    return {
      voiceId: voice.voiceId,
      name: voice.name,
      previewUrl: voice.previewUrl,
      labels: voice.labels,
      category: voice.category,
      description: voice.description,
      languages: voice.languages,
      gender,
      enabled: existing?.enabled ?? false,
    }
  })

  return jsonResponse({
    voices,
    enabledCount: voices.filter((voice) => voice.enabled).length,
  })
})
