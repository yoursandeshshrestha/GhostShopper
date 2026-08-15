import { useEffect } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { LocationsStep } from '@/components/setup/LocationsStep'
import { ReviewStep } from '@/components/setup/ReviewStep'
import { ScenarioStep } from '@/components/setup/ScenarioStep'
import { ScorecardStep } from '@/components/setup/ScorecardStep'
import { SetupWizardLayout } from '@/components/setup/SetupWizardLayout'
import { TeamStep } from '@/components/setup/TeamStep'
import { WelcomeStep } from '@/components/setup/WelcomeStep'
import { useSetupStore } from '@/stores/setup-store'
import {
  setupProgressPercent,
  type SetupStep,
} from '@/types/setup'

function isSetupStep(value: string | null | undefined): value is SetupStep {
  return (
    value === 'welcome' ||
    value === 'locations' ||
    value === 'scorecard' ||
    value === 'scenario' ||
    value === 'team' ||
    value === 'review'
  )
}

export function SetupWizard() {
  const { organisation } = useAuth()
  const hydrate = useSetupStore((s) => s.hydrate)
  const reset = useSetupStore((s) => s.reset)
  const hydrated = useSetupStore((s) => s.hydrated)
  const step = useSetupStore((s) => s.step)
  const saveStatus = useSetupStore((s) => s.saveStatus)
  const error = useSetupStore((s) => s.error)
  const orgName = useSetupStore((s) => s.orgName)

  useEffect(() => {
    if (!organisation?.id) return
    const setupStep = isSetupStep(organisation.setupStep)
      ? organisation.setupStep
      : 'welcome'
    void hydrate(organisation.id, organisation.name, setupStep)
    return () => {
      reset()
    }
  }, [organisation?.id, organisation?.name, organisation?.setupStep, hydrate, reset])

  if (!organisation || !hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    )
  }

  const progress = setupProgressPercent(step)

  return (
    <SetupWizardLayout
      step={step}
      progress={progress}
      saveStatus={saveStatus}
      orgName={orgName}
    >
      {error ? (
        <Alert variant="destructive" className="border-destructive/30">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'welcome' ? <WelcomeStep /> : null}
      {step === 'locations' ? <LocationsStep /> : null}
      {step === 'scorecard' ? <ScorecardStep /> : null}
      {step === 'scenario' ? <ScenarioStep /> : null}
      {step === 'team' ? <TeamStep /> : null}
      {step === 'review' ? <ReviewStep /> : null}
    </SetupWizardLayout>
  )
}
