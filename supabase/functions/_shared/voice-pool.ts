export type VoiceGender = "female" | "male" | "neutral"

export interface PoolVoice {
  elevenlabsVoiceId: string
  name: string
  gender: VoiceGender
  labels: Record<string, string>
}

const FEMALE_CUES =
  /\b(she|her|hers|woman|female|lady|girl|mrs|ms|miss|madam)\b/i
const MALE_CUES =
  /\b(he|him|his|man|male|gentleman|boy|mr|sir)\b/i

const USE_CASE_HINTS: Record<string, string[]> = {
  conversational: [
    "call",
    "phone",
    "enquiry",
    "inquiry",
    "appointment",
    "booking",
    "customer",
    "conversation",
    "shop",
  ],
  narration: ["narrat", "story", "audiobook"],
  characters_animation: ["character", "roleplay", "persona"],
  entertainment_tv: ["tv", "entertainment", "media"],
  news: ["news", "bulletin"],
  social_media: ["social", "influencer"],
}

export function parseVoiceGender(value: unknown): VoiceGender | null {
  if (value === "female" || value === "male" || value === "neutral") {
    return value
  }
  return null
}

export function genderFromLabels(labels: Record<string, string>): VoiceGender {
  const raw = (labels.gender || labels.sex || "").toLowerCase()
  if (raw.includes("female") || raw === "f" || raw === "woman") return "female"
  if (raw.includes("male") || raw === "m" || raw === "man") return "male"
  return "neutral"
}

function promptGender(text: string): VoiceGender | null {
  const female = FEMALE_CUES.test(text)
  const male = MALE_CUES.test(text)
  if (female && !male) return "female"
  if (male && !female) return "male"
  return null
}

export function scoreVoice(voice: PoolVoice, systemPrompt: string) {
  const haystack = systemPrompt.toLowerCase()
  let score = 0

  const useCase = (voice.labels.use_case || "").toLowerCase()
  if (useCase === "conversational") score += 4
  if (useCase) {
    const readable = useCase.replace(/_/g, " ")
    if (readable.length > 3 && haystack.includes(readable)) score += 14
    for (const hint of USE_CASE_HINTS[useCase] ?? []) {
      if (haystack.includes(hint)) score += 6
    }
  }

  for (const [key, raw] of Object.entries(voice.labels)) {
    if (key === "use_case" || key === "language") continue
    const token = raw.toLowerCase().replace(/_/g, " ").trim()
    if (token.length < 3 || !haystack.includes(token)) continue
    if (key === "gender") score += 10
    else if (key === "accent") score += 6
    else if (key === "age") score += 4
    else score += 2
  }

  const needed = promptGender(haystack)
  if (needed && voice.gender === needed) score += 12
  if (
    needed &&
    voice.gender !== "neutral" &&
    voice.gender !== needed
  ) {
    score -= 20
  }

  return score
}

function randomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return items[buf[0] % items.length] ?? null
}

export function pickVoiceFromPool(
  pool: PoolVoice[],
  systemPrompt: string,
  recentVoiceIds: string[] = []
): PoolVoice | null {
  if (pool.length === 0) return null

  const ranked = pool.map((voice) => ({
    voice,
    score: scoreVoice(voice, systemPrompt),
  }))
  ranked.sort((a, b) => b.score - a.score)

  const top = ranked[0]?.score ?? 0
  const candidates = ranked
    .filter((row) => row.score >= 0 && row.score >= top - 8)
    .map((row) => row.voice)

  const rotation = candidates.length > 0 ? candidates : pool
  const unused = rotation.filter(
    (voice) => !recentVoiceIds.includes(voice.elevenlabsVoiceId)
  )
  if (unused.length > 0) return randomItem(unused)

  let oldest: PoolVoice | null = null
  let oldestIndex = -1
  for (const voice of rotation) {
    const index = recentVoiceIds.indexOf(voice.elevenlabsVoiceId)
    if (index > oldestIndex) {
      oldestIndex = index
      oldest = voice
    }
  }

  return oldest ?? randomItem(rotation)
}
