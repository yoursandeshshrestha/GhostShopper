import { useMemo, useState } from 'react'
import {
  Brain,
  ChatTeardropText,
  Check,
  ClipboardText,
  PhoneCall,
  WarningCircle,
} from '@phosphor-icons/react'
import { AiModelCombobox } from '@/components/admin/AiModelCombobox'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePlatformAiSettings } from '@/hooks/use-platform-ai-settings'
import {
  DEFAULT_CALLER_SYSTEM_PROMPT,
  DEFAULT_GRADING_SYSTEM_PROMPT,
  DEFAULT_SCENARIO_SYSTEM_PROMPT,
} from '@/lib/default-ai-prompts'
import { formatDateTimeShort } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  SettingsRow,
  SettingsSection,
} from '@/pages/settings/components/SettingsSection'

const promptClassName = cn(
  'h-[calc(100dvh-20rem)] min-h-[40rem] resize-y overflow-y-auto font-mono text-xs leading-relaxed',
  'field-sizing-fixed'
)

function PromptEditor({
  id,
  value,
  onChange,
  defaultValue,
  onReset,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  defaultValue: string
  onReset: () => void
}) {
  const isDefault = value.trim() === defaultValue.trim()

  return (
    <div className="space-y-3 px-5 py-4">
      <Textarea
        id={id}
        className={promptClassName}
        value={value}
        maxLength={50000}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {value.length.toLocaleString()} characters
        </p>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={isDefault}
          onClick={onReset}
        >
          Reset to default
        </Button>
      </div>
    </div>
  )
}

export function AdminAiPage() {
  const {
    loading,
    saving,
    error,
    settings,
    scenarioModel,
    setScenarioModel,
    gradingModel,
    setGradingModel,
    callerSystemPrompt,
    setCallerSystemPrompt,
    scenarioSystemPrompt,
    setScenarioSystemPrompt,
    gradingSystemPrompt,
    setGradingSystemPrompt,
    dirty,
    save,
  } = usePlatformAiSettings()

  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSave = useMemo(
    () =>
      Boolean(
        scenarioModel.trim() &&
          gradingModel.trim() &&
          callerSystemPrompt.trim() &&
          scenarioSystemPrompt.trim() &&
          gradingSystemPrompt.trim() &&
          dirty
      ),
    [
      callerSystemPrompt,
      dirty,
      gradingModel,
      gradingSystemPrompt,
      scenarioModel,
      scenarioSystemPrompt,
    ]
  )

  async function onSave() {
    setActionError(null)
    const result = await save()
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSuccessMessage('AI settings updated')
    window.setTimeout(() => setSuccessMessage(null), 3000)
  }

  const saveButton = (
    <Button
      type="button"
      size="sm"
      loading={saving}
      disabled={!canSave}
      onClick={() => void onSave()}
    >
      Save changes
    </Button>
  )

  return (
    <AppPage title="AI" loading={loading} actions={settings ? saveButton : null}>
      {error && !settings ? (
        <PageEmptyState title="Could not load AI settings" description={error} />
      ) : (
        <div className="space-y-4">
          {error || actionError ? (
            <Alert variant="destructive">
              <WarningCircle weight="fill" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{actionError || error}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert>
              <Check weight="bold" />
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Alert>
            <Brain className="size-4" />
            <AlertTitle>Platform AI control</AlertTitle>
            <AlertDescription>
              Models and system prompts apply to every organisation. Live calls
              still receive that call&apos;s organisation, location, and
              scenario after the caller prompt.
              {settings?.updatedAt ? (
                <> Last updated {formatDateTimeShort(settings.updatedAt)}.</>
              ) : null}
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="caller" className="gap-4">
            <TabsList variant="line">
              <TabsTrigger value="caller">
                <PhoneCall />
                Live caller
              </TabsTrigger>
              <TabsTrigger value="scenario">
                <ChatTeardropText />
                Scenarios
              </TabsTrigger>
              <TabsTrigger value="grading">
                <ClipboardText />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="models">
                <Brain />
                Models
              </TabsTrigger>
            </TabsList>

            <TabsContent value="caller" className="mt-0">
              <SettingsSection
                title="Live caller prompt"
                description="Permanent behaviour for every outbound ElevenLabs call. GhostShopper appends the target business, location, persona, goals, and scenario-specific rules after this text."
              >
                <PromptEditor
                  id="caller-system-prompt"
                  value={callerSystemPrompt}
                  onChange={setCallerSystemPrompt}
                  defaultValue={DEFAULT_CALLER_SYSTEM_PROMPT}
                  onReset={() =>
                    setCallerSystemPrompt(DEFAULT_CALLER_SYSTEM_PROMPT)
                  }
                />
              </SettingsSection>
            </TabsContent>

            <TabsContent value="scenario" className="mt-0">
              <SettingsSection
                title="Scenario generator prompt"
                description="Used when an operator turns a brief into persona, goals, and conversation rules. GhostShopper appends the operator brief and industry after this text."
              >
                <PromptEditor
                  id="scenario-system-prompt"
                  value={scenarioSystemPrompt}
                  onChange={setScenarioSystemPrompt}
                  defaultValue={DEFAULT_SCENARIO_SYSTEM_PROMPT}
                  onReset={() =>
                    setScenarioSystemPrompt(DEFAULT_SCENARIO_SYSTEM_PROMPT)
                  }
                />
              </SettingsSection>
            </TabsContent>

            <TabsContent value="grading" className="mt-0">
              <SettingsSection
                title="Call analysis prompt"
                description="Used to grade transcripts, flag issues, and draft coaching notes. GhostShopper appends the scorecard, scenario brief, and transcript after this text."
              >
                <PromptEditor
                  id="grading-system-prompt"
                  value={gradingSystemPrompt}
                  onChange={setGradingSystemPrompt}
                  defaultValue={DEFAULT_GRADING_SYSTEM_PROMPT}
                  onReset={() =>
                    setGradingSystemPrompt(DEFAULT_GRADING_SYSTEM_PROMPT)
                  }
                />
              </SettingsSection>
            </TabsContent>

            <TabsContent value="models" className="mt-0">
              <SettingsSection
                title="Model selection"
                description="Pick a preset or enter any OpenRouter model ID. Voice calls use ElevenLabs separately."
              >
                <SettingsRow
                  label="Scenario generation"
                  description="Used when turning a brief into persona, goals, and conversation rules."
                  htmlFor="scenario-model"
                >
                  <AiModelCombobox
                    id="scenario-model"
                    value={scenarioModel}
                    onChange={setScenarioModel}
                  />
                </SettingsRow>
                <SettingsRow
                  label="Call analysis"
                  description="Used to grade transcripts, flag issues, and draft coaching notes."
                  htmlFor="grading-model"
                >
                  <AiModelCombobox
                    id="grading-model"
                    value={gradingModel}
                    onChange={setGradingModel}
                  />
                </SettingsRow>
              </SettingsSection>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppPage>
  )
}
