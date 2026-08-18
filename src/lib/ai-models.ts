export interface AiModelOption {
  id: string
  label: string
  description: string
}

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fast and cost-effective. Good default for JSON tasks.',
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Higher quality reasoning for complex scenarios and grading.',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Strong instruction following and nuanced analysis.',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Balanced OpenAI model for structured outputs.',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    description: 'Higher-quality OpenAI model for detailed call analysis.',
  },
]

export function isKnownAiModel(modelId: string): boolean {
  return AI_MODEL_OPTIONS.some((option) => option.id === modelId)
}

export function aiModelLabel(modelId: string): string {
  const match = AI_MODEL_OPTIONS.find((option) => option.id === modelId)
  return match?.label ?? modelId
}
