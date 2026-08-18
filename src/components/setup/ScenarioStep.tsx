import { useMemo, useState } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import {
  ChoiceCard,
  StepFooter,
  StepFrame,
  StepHeader,
} from '@/components/setup/StepChrome'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSetupStore } from '@/stores/setup-store'
import { SCENARIO_TEMPLATES } from '@/types/setup'

export function ScenarioStep() {
  const scenario = useSetupStore((s) => s.scenario)
  const applyScenarioTemplate = useSetupStore((s) => s.applyScenarioTemplate)
  const setScenarioPrompt = useSetupStore((s) => s.setScenarioPrompt)
  const setScenarioName = useSetupStore((s) => s.setScenarioName)
  const generateScenario = useSetupStore((s) => s.generateScenario)
  const approveScenario = useSetupStore((s) => s.approveScenario)
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)
  const generating = useSetupStore((s) => s.generating)

  const [error, setError] = useState<string | null>(null)

  const selectedTemplateId = useMemo(
    () =>
      SCENARIO_TEMPLATES.find(
        (template) =>
          template.name === scenario.name.trim() &&
          template.prompt === scenario.prompt.trim()
      )?.id ?? null,
    [scenario.name, scenario.prompt]
  )

  const hasPreview = Boolean(
    scenario.persona && scenario.goals && scenario.conversationRules
  )

  async function onGenerate() {
    setError(null)
    const { error: generateError } = await generateScenario()
    if (generateError) setError(generateError)
  }

  async function onApprove() {
    setError(null)
    const { error: approveError } = await approveScenario()
    if (approveError) {
      setError(approveError)
      return
    }
    await setStep('team')
  }

  return (
    <StepFrame>
      <StepHeader
        title="Create AI scenario"
        description="Pick an example template or describe the customer yourself. We will generate a full persona you can edit."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t generate or save scenario</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Example templates</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SCENARIO_TEMPLATES.map((template) => (
              <ChoiceCard
                key={template.id}
                title={template.name}
                description={template.description}
                selected={selectedTemplateId === template.id}
                onClick={() =>
                  applyScenarioTemplate({
                    name: template.name,
                    prompt: template.prompt,
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="agentName">Agent name</FieldLabel>
            <Input
              id="agentName"
              value={scenario.name}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Website enquiry customer"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="scenarioPrompt">Describe the customer</FieldLabel>
            <Textarea
              id="scenarioPrompt"
              value={scenario.prompt}
              onChange={(e) => setScenarioPrompt(e.target.value)}
              placeholder="I want the AI to call pretending to book a dental appointment."
              className="min-h-32"
            />
          </Field>

          <Button
            type="button"
            variant="secondary"
            disabled={!scenario.prompt.trim()}
            loading={generating}
            onClick={() => void onGenerate()}
          >
            <Sparkle />
            Generate scenario
          </Button>
        </div>
      </div>

      {hasPreview ? (
        <div className="space-y-4 rounded-xl bg-muted/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Preview</p>
            {scenario.approved ? (
              <span className="text-xs text-muted-foreground">Approved</span>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Persona</p>
              <p className="text-sm leading-relaxed text-foreground">
                {scenario.persona}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Goals</p>
              <p className="text-sm leading-relaxed text-foreground">
                {scenario.goals}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Conversation rules</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {scenario.conversationRules}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <StepFooter
        onBack={() => void setStep('scorecard')}
        onContinue={() => void onApprove()}
        continueLabel={scenario.approved ? 'Continue' : 'Approve scenario'}
        continueLoading={saving}
        continueDisabled={!scenario.name.trim() || !hasPreview}
      />
    </StepFrame>
  )
}
