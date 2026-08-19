const MAX_KEYWORDS = 15
const MAX_KEYWORD_LENGTH = 48

const GENERIC_TERMS = new Set([
  "a",
  "about",
  "afternoon",
  "an",
  "and",
  "appointment",
  "are",
  "ask",
  "at",
  "availability",
  "available",
  "be",
  "book",
  "booking",
  "branch",
  "by",
  "call",
  "can",
  "centre",
  "center",
  "city",
  "clinic",
  "co",
  "company",
  "cost",
  "customer",
  "day",
  "days",
  "details",
  "enquiry",
  "establish",
  "evening",
  "find",
  "first",
  "for",
  "from",
  "general",
  "group",
  "gym",
  "help",
  "hi",
  "hello",
  "holdings",
  "hospital",
  "hotel",
  "hours",
  "how",
  "if",
  "in",
  "inc",
  "information",
  "inquiry",
  "international",
  "is",
  "it",
  "limited",
  "llc",
  "location",
  "ltd",
  "morning",
  "next",
  "no",
  "not",
  "of",
  "office",
  "on",
  "or",
  "our",
  "phone",
  "plc",
  "please",
  "price",
  "pricing",
  "process",
  "quote",
  "restaurant",
  "salon",
  "school",
  "service",
  "services",
  "shop",
  "spa",
  "staff",
  "standard",
  "step",
  "store",
  "street",
  "team",
  "town",
  "thank",
  "thanks",
  "that",
  "the",
  "their",
  "they",
  "this",
  "time",
  "to",
  "today",
  "tomorrow",
  "understand",
  "uk",
  "us",
  "usa",
  "we",
  "website",
  "week",
  "with",
  "yes",
  "you",
  "your",
])

export interface AsrKeywordSource {
  organisationName?: string | null
  locationName?: string | null
  prompt?: string | null
  goals?: string | null
  conversationRules?: string | null
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function isGeneric(value: string) {
  const words = value
    .toLowerCase()
    .split(/[\s/]+/)
    .filter(Boolean)
  if (words.length === 0) return true
  return words.every((word) => GENERIC_TERMS.has(word) || word.length < 2)
}

function addKeyword(
  keywords: string[],
  seen: Set<string>,
  value: string | null | undefined,
  options: { required?: boolean } = {}
) {
  const trimmed = value ? normalize(value) : ""
  if (trimmed.length < 2 || trimmed.length > MAX_KEYWORD_LENGTH) return
  if (/^\d+$/.test(trimmed)) return
  if (!options.required && isGeneric(trimmed)) return
  const key = trimmed.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  keywords.push(trimmed)
}

function splitName(name: string) {
  const parts = [name]
  for (const chunk of name.split(/[-–—,|/()]+/)) {
    parts.push(chunk)
  }
  for (const token of name.split(/[\s\-–—,|/()]+/)) {
    parts.push(token)
  }
  return parts
}

function extractScenarioTerms(text: string) {
  const found: string[] = []
  for (const match of text.matchAll(/[“"]([^”"]{2,40})[”"]/g)) {
    if (match[1]) found.push(match[1])
  }
  for (const match of text.matchAll(
    /\b([A-Z][a-zA-Z0-9'’]+(?:\s+[A-Z][a-zA-Z0-9'’]+)+)\b/g
  )) {
    if (match[1]) found.push(match[1])
  }
  for (const match of text.matchAll(/\b([A-Z][a-zA-Z0-9'’]{4,})\b/g)) {
    if (match[1]) found.push(match[1])
  }
  return found
}

export function buildAsrKeywords(source: AsrKeywordSource): string[] {
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const name of [source.organisationName, source.locationName]) {
    if (!name?.trim()) continue
    addKeyword(keywords, seen, name, { required: true })
    for (const part of splitName(name)) {
      addKeyword(keywords, seen, part)
    }
  }

  const scenarioText = [source.prompt, source.goals, source.conversationRules]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")

  for (const term of extractScenarioTerms(scenarioText)) {
    if (keywords.length >= MAX_KEYWORDS) break
    addKeyword(keywords, seen, term)
  }

  return keywords.slice(0, MAX_KEYWORDS)
}
