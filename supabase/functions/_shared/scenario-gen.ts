import { completeJson, llmApiKey, parseModelJson } from "./openrouter.ts"
import { DEFAULT_SCENARIO_SYSTEM_PROMPT } from "./default-ai-prompts.ts"
import { loadPlatformAiSettings } from "./platform-ai-settings.ts"
import {
  logLlmUsage,
  logMockLlmUsage,
  type UsageLogContext,
} from "./usage-events.ts"

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

function scenarioPrompt(
  prompt: string,
  industry: string | null,
  systemPrompt: string,
  retried = false
) {
  const brief = prompt.trim()
  const instructions = systemPrompt.trim() || DEFAULT_SCENARIO_SYSTEM_PROMPT
  return `${instructions}

The operator described this call scenario:
---
${brief}
---
${industry ? `Industry context: ${industry}` : "No industry was supplied."}

Return JSON with persona, goals, and conversation_rules.${
    retried
      ? "\n\nReturn strictly valid JSON. Escape quotes and newlines inside string values."
      : ""
  }`
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
      "Wait for the employee to greet you before speaking.",
      "Do not reveal you are an AI or mystery shopper.",
      "Ask natural follow-up questions when answers are vague.",
      `Scenario intent: ${trimmed}`,
    ].join("\n"),
    graderModel: "dev-mock-scenario",
  }
}

function readGeneratedScenario(
  parsed: Record<string, unknown>
): Omit<GeneratedScenario, "graderModel"> {
  const persona =
    typeof parsed.persona === "string" ? parsed.persona.trim() : ""
  const goals = typeof parsed.goals === "string" ? parsed.goals.trim() : ""
  const conversationRules =
    typeof parsed.conversation_rules === "string"
      ? parsed.conversation_rules.trim()
      : ""

  if (!persona || !goals || !conversationRules) {
    throw new Error("Model response was missing required scenario fields")
  }

  return { persona, goals, conversationRules }
}

async function callOpenRouter(
  prompt: string,
  industry: string | null,
  retried = false,
  logContext?: UsageLogContext
): Promise<GeneratedScenario> {
  const settings = await loadPlatformAiSettings()
  const { text, model: usedModel, usage } = await completeJson({
    schemaName: "mystery_shop_scenario",
    schema: scenarioSchema(),
    prompt: scenarioPrompt(
      prompt,
      industry,
      settings.scenarioSystemPrompt,
      retried
    ),
    maxTokens: 4096,
    model: settings.scenarioModel,
  })

  if (logContext && usage) {
    await logLlmUsage(
      logContext,
      "scenario_gen",
      {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        model: usedModel,
      },
      usage.costUsd
    )
  }

  try {
    const parsed = parseModelJson(text)
    const fields = readGeneratedScenario(parsed)
    return { ...fields, graderModel: usedModel }
  } catch (error) {
    if (!retried) {
      return callOpenRouter(prompt, industry, true, logContext)
    }

    const message =
      error instanceof Error ? error.message : "Could not parse scenario JSON"
    throw new Error(
      `The AI returned malformed scenario data (${message}). Try again or shorten your description.`
    )
  }
}

export async function generateScenarioFields(
  prompt: string,
  industry: string | null,
  logContext?: UsageLogContext
): Promise<GeneratedScenario> {
  if (!prompt.trim()) {
    throw new Error("Describe the customer scenario first.")
  }

  if (!llmApiKey()) {
    if (logContext) {
      await logMockLlmUsage(logContext, "scenario_gen", "dev-mock-scenario")
    }
    return mockScenario(prompt)
  }

  return callOpenRouter(prompt, industry, false, logContext)
}
