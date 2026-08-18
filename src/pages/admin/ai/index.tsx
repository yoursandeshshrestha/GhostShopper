import { useMemo, useState } from 'react'
import { Brain, Check, WarningCircle } from '@phosphor-icons/react'
import { AiModelCombobox } from '@/components/admin/AiModelCombobox'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { usePlatformAiSettings } from '@/hooks/use-platform-ai-settings'
import { formatDateTimeShort } from '@/lib/datetime'
import {
  SettingsRow,
  SettingsSection,
} from '@/pages/settings/components/SettingsSection'

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
    dirty,
    save,
  } = usePlatformAiSettings()

  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSave = useMemo(
    () => Boolean(scenarioModel.trim() && gradingModel.trim() && dirty),
    [dirty, gradingModel, scenarioModel]
  )

  async function onSave() {
    setActionError(null)
    const result = await save()
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSuccessMessage('AI model settings updated')
    window.setTimeout(() => setSuccessMessage(null), 3000)
  }

  return (
    <AppPage title="AI models" loading={loading}>
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
            <AlertTitle>Two AI workflows</AlertTitle>
            <AlertDescription>
              OpenRouter is only used in two places: scenario generation during
              setup, and call analysis after a completed shop. Voice calls use
              ElevenLabs separately.
              {settings?.updatedAt ? (
                <>
                  {' '}
                  Last updated {formatDateTimeShort(settings.updatedAt)}.
                </>
              ) : null}
            </AlertDescription>
          </Alert>

          <SettingsSection
            title="Model selection"
            description="Pick a preset or enter any OpenRouter model ID."
            footer={
              <Button
                type="button"
                size="sm"
                loading={saving}
                disabled={!canSave}
                onClick={() => void onSave()}
              >
                Save changes
              </Button>
            }
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
        </div>
      )}
    </AppPage>
  )
}
