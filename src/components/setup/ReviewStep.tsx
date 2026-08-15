import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from '@phosphor-icons/react'
import { StepFooter, StepFrame, StepHeader } from '@/components/setup/StepChrome'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSetupStore } from '@/stores/setup-store'
import { cn } from '@/lib/utils'

export function ReviewStep() {
  const navigate = useNavigate()
  const { refreshProfile, organisation } = useAuth()
  const orgName = useSetupStore((s) => s.orgName)
  const locations = useSetupStore((s) => s.locations)
  const criteria = useSetupStore((s) => s.criteria)
  const scenario = useSetupStore((s) => s.scenario)
  const invites = useSetupStore((s) => s.invites)
  const setStep = useSetupStore((s) => s.setStep)
  const finishSetup = useSetupStore((s) => s.finishSetup)
  const finishing = useSetupStore((s) => s.finishing)

  const [error, setError] = useState<string | null>(null)
  const savedInvites = invites.filter((invite) => invite.saved).length

  const items: Array<{
    label: string
    detail: string
    ok: boolean
    step: 'locations' | 'scorecard' | 'scenario' | 'team' | null
  }> = [
    {
      label: 'Organization',
      detail: orgName || organisation?.name || 'Configured',
      ok: true,
      step: null,
    },
    {
      label: 'Locations',
      detail: `${locations.length} location${locations.length === 1 ? '' : 's'}`,
      ok: locations.length > 0,
      step: 'locations',
    },
    {
      label: 'Scorecard',
      detail: `${criteria.length} criteria`,
      ok: criteria.length > 0,
      step: 'scorecard',
    },
    {
      label: 'Scenario',
      detail: scenario.approved ? 'Approved' : 'Not approved',
      ok: scenario.approved,
      step: 'scenario',
    },
    {
      label: 'Team',
      detail:
        savedInvites > 0
          ? `${savedInvites} invite${savedInvites === 1 ? '' : 's'}`
          : 'Skipped',
      ok: true,
      step: 'team',
    },
  ]

  async function onFinish() {
    setError(null)
    const { error: finishError } = await finishSetup()
    if (finishError) {
      setError(finishError)
      return
    }
    await refreshProfile()
    navigate('/dashboard', { replace: true })
  }

  return (
    <StepFrame>
      <StepHeader
        title="Review & launch"
        description="Everything looks ready. Finish setup to open your dashboard."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t finish setup</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="overflow-hidden rounded-xl bg-muted/40">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                  item.ok
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                <Check className="size-3" weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>
            {item.step ? (
              <button
                type="button"
                className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => void setStep(item.step!)}
              >
                Edit
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <StepFooter
        onBack={() => void setStep('team')}
        onContinue={() => void onFinish()}
        continueLabel="Finish setup"
        continueLoading={finishing}
      />
    </StepFrame>
  )
}
