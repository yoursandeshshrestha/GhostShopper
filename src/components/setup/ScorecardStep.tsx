import { useEffect, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import {
  ChoiceCard,
  StepFooter,
  StepFrame,
  StepHeader,
} from '@/components/setup/StepChrome'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSetupStore } from '@/stores/setup-store'
import { createLocalId, scorecardWeightTotal } from '@/types/setup'
import { cn } from '@/lib/utils'

export function ScorecardStep() {
  const scorecardMode = useSetupStore((s) => s.scorecardMode)
  const criteria = useSetupStore((s) => s.criteria)
  const setScorecardMode = useSetupStore((s) => s.setScorecardMode)
  const updateCriterion = useSetupStore((s) => s.updateCriterion)
  const setCriteria = useSetupStore((s) => s.setCriteria)
  const saveScorecard = useSetupStore((s) => s.saveScorecard)
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)

  const [error, setError] = useState<string | null>(null)
  const total = scorecardWeightTotal(criteria)

  useEffect(() => {
    if (criteria.length > 0 && !scorecardMode) {
      setScorecardMode('custom')
    }
  }, [criteria.length, scorecardMode, setScorecardMode])

  useEffect(() => {
    if (!scorecardMode || criteria.length === 0) return
    if (scorecardWeightTotal(criteria) !== 100) return
    if (criteria.some((item) => !item.name.trim())) return

    const timer = window.setTimeout(() => {
      void saveScorecard().then(({ error: saveError }) => {
        if (saveError) setError(saveError)
        else setError(null)
      })
    }, 600)

    return () => window.clearTimeout(timer)
  }, [criteria, scorecardMode, saveScorecard])

  async function onContinue() {
    setError(null)
    const { error: saveError } = await saveScorecard()
    if (saveError) {
      setError(saveError)
      return
    }
    await setStep('scenario')
  }

  return (
    <StepFrame>
      <StepHeader
        title="Create scorecard"
        description="How should we evaluate your staff on each call? Weights must add up to 100."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save scorecard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!scorecardMode ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            title="Use default scorecard"
            description="Greeting, professionalism, product knowledge, and more — ready to edit."
            onClick={() => setScorecardMode('default')}
          />
          <ChoiceCard
            title="Create custom"
            description="Build your own criteria and weights from scratch."
            onClick={() => setScorecardMode('custom')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {scorecardMode === 'default'
                ? 'Default scorecard — edit anything you need'
                : 'Custom scorecard'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCriteria([])
                useSetupStore.setState({ scorecardMode: null })
              }}
            >
              Change option
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl bg-muted/40">
            <div className="grid grid-cols-[1fr_88px_40px] gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
              <span>Criterion</span>
              <span>Weight</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {criteria.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_88px_40px] items-center gap-2 px-4 py-2.5"
                >
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      updateCriterion(item.id, { name: e.target.value })
                    }
                    placeholder="Greeting"
                    className="border-transparent bg-transparent shadow-none focus-visible:border-ring focus-visible:bg-input/30"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.weight}
                    onChange={(e) =>
                      updateCriterion(item.id, {
                        weight: Number(e.target.value),
                      })
                    }
                    className="border-transparent bg-transparent text-center shadow-none focus-visible:border-ring focus-visible:bg-input/30"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={criteria.length <= 1}
                    onClick={() =>
                      setCriteria(criteria.filter((row) => row.id !== item.id))
                    }
                    aria-label={`Remove ${item.name || 'criterion'}`}
                  >
                    <Trash />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setCriteria([
                    ...criteria,
                    { id: createLocalId(), name: '', weight: 0 },
                  ])
                }
              >
                <Plus />
                Add criterion
              </Button>
              <p
                className={cn(
                  'text-sm font-medium tabular-nums',
                  total === 100 ? 'text-foreground' : 'text-destructive'
                )}
              >
                {total} / 100
              </p>
            </div>
          </div>
        </div>
      )}

      <StepFooter
        onBack={() => void setStep('locations')}
        onContinue={() => void onContinue()}
        continueLoading={saving}
        continueDisabled={!scorecardMode || criteria.length === 0 || total !== 100}
      />
    </StepFrame>
  )
}
