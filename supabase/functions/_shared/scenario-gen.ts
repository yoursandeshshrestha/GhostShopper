import { completeJson, llmApiKey } from "./openrouter.ts"

export interface GeneratedScenario {
  persona: string
  goals: string
  conversationRules: string
  graderModel: string
}

function scenarioSchema() {
  return {
    type: "object",
    properties: {
      persona: { type: "string" },
      goals: { type: "string" },
      conversation_rules: { type: "string" },
    },
    required: ["persona", "goals", "conversation_rules"],
    additionalProperties: false,
  }
}

function scenarioPrompt(prompt: string, industry: string | null) {
  return `You are helping configure a mystery-shopping AI caller for a multi-location brand.

The operator described this call scenario in one sentence:
"${prompt.trim()}"

${industry ? `Industry context: ${industry}` : ""}

Write realistic mystery-shopper configuration fields:
- persona: 2-4 sentences describing who the caller is, tone, and level of certainty
- goals: bullet-style paragraph of what the caller should try to achieve on the call
- conversation_rules: newline-separated rules the AI caller must follow (stay in character, no revealing they are AI, natural follow-ups, etc.)

Keep language practical for phone calls to front-line staff.`
}

function mockScenario(prompt: string): GeneratedScenario {
  const trimmed = prompt.trim() || "general service enquiry"
  return {
    persona:
      "A polite first-time customer who is mildly unsure and asks clarifying questions before committing.",
    goals:
      "Understand opening hours and pricing cues, book an appointment if possible, and note how staff handle objections or being busy.",
    conversationRules: [
      "Stay in character as a real customer.",
      "Do not reveal you are an AI or mystery shopper.",
      "Ask natural follow-up questions when answers are vague.",
      `Scenario intent: ${trimmed}`,
    ].join("\n"),
    graderModel: "dev-mock-scenario",
  }
}

async function callOpenRouter(
  prompt: string,
  industry: string | null
): Promise<GeneratedScenario> {
  const { text, model } = await completeJson({
    schemaName: "mystery_shop_scenario",
    schema: scenarioSchema(),
    prompt: scenarioPrompt(prompt, industry),
    maxTokens: 4096,
  })

  const parsed = JSON.parse(text) as {
    persona: string
    goals: string
    conversation_rules: string
  }

  return {
    persona: parsed.persona.trim(),
    goals: parsed.goals.trim(),
    conversationRules: parsed.conversation_rules.trim(),
    graderModel: model,
  }
}

export async function generateScenarioFields(
  prompt: string,
  industry: string | null
): Promise<GeneratedScenario> {
  if (!prompt.trim()) {
    throw new Error("Describe the customer scenario first.")
  }

  if (!llmApiKey()) {
    return mockScenario(prompt)
  }

  return callOpenRouter(prompt, industry)
}
