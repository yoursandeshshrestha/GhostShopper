import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneOutgoing, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfacePanel } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCalls } from '@/hooks/use-calls'
import { cn } from '@/lib/utils'

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

export function NewCallPage() {
  const navigate = useNavigate()
  const {
    loading,
    saving,
    error,
    canCreate,
    locations,
    agents,
    scorecards,
    defaultAgent,
    defaultScorecard,
    createCall,
  } = useCalls()

  const [locationId, setLocationId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [scorecardId, setScorecardId] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const approvedAgents = useMemo(
    () => agents.filter((agent) => agent.approved),
    [agents]
  )

  useEffect(() => {
    if (!locationId && locations[0]?.id) {
      setLocationId(locations[0].id)
    }
  }, [locationId, locations])

  useEffect(() => {
    if (!scenarioId && defaultAgent?.approved) {
      setScenarioId(defaultAgent.id)
    } else if (
      !scenarioId &&
      approvedAgents[0]?.id &&
      approvedAgents.some((agent) => agent.id === defaultAgent?.id)
    ) {
      setScenarioId(approvedAgents[0].id)
    } else if (!scenarioId && approvedAgents[0]?.id) {
      setScenarioId(approvedAgents[0].id)
    }
  }, [approvedAgents, defaultAgent, scenarioId])

  useEffect(() => {
    if (!scorecardId && defaultScorecard?.id) {
      setScorecardId(defaultScorecard.id)
    } else if (!scorecardId && scorecards[0]?.id) {
      setScorecardId(scorecards[0].id)
    }
  }, [defaultScorecard, scorecardId, scorecards])

  const canStart =
    Boolean(locationId) && Boolean(scenarioId) && Boolean(scorecardId)

  async function onStart() {
    setActionError(null)
    const result = await createCall({ locationId, scenarioId, scorecardId })
    if (result.error) {
      setActionError(result.error)
      return
    }
    navigate('/review')
  }

  return (
    <AppPage title="New call" loading={loading}>
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!canCreate ? (
        <PageEmptyState
          title="No permission"
          description="Only owners, admins, and coaches can start mystery-shop calls."
        />
      ) : locations.length === 0 ? (
        <PageEmptyState
          title="Add a location first"
          description="GhostShopper needs at least one location before it can place a call."
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/locations')}
            >
              Go to locations
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,480px)_1fr]">
          <SurfacePanel className="space-y-5">
            {approvedAgents.length === 0 ? (
              <Alert>
                <WarningCircle />
                <AlertTitle>No approved agents</AlertTitle>
                <AlertDescription>
                  Create and approve an agent on the Agent page before
                  starting a call.
                </AlertDescription>
              </Alert>
            ) : null}

            {scorecards.length === 0 ? (
              <Alert>
                <WarningCircle />
                <AlertTitle>No scorecards</AlertTitle>
                <AlertDescription>
                  Create a scorecard before starting a call.
                </AlertDescription>
              </Alert>
            ) : null}

            <Field className="gap-2">
              <FieldLabel>Location</FieldLabel>
              <Select
                value={locationId || undefined}
                onValueChange={(value) => setLocationId(value ?? '')}
              >
                <SelectTrigger
                  className={cn(fieldControlClassName, 'justify-between')}
                >
                  <SelectValue placeholder="Choose location" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-2">
              <FieldLabel>Agent</FieldLabel>
              <Select
                value={scenarioId || undefined}
                onValueChange={(value) => setScenarioId(value ?? '')}
              >
                <SelectTrigger
                  className={cn(fieldControlClassName, 'justify-between')}
                >
                  <SelectValue placeholder="Choose agent" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  {approvedAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                      {agent.isDefault ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-2">
              <FieldLabel>Scorecard</FieldLabel>
              <Select
                value={scorecardId || undefined}
                onValueChange={(value) => setScorecardId(value ?? '')}
              >
                <SelectTrigger
                  className={cn(fieldControlClassName, 'justify-between')}
                >
                  <SelectValue placeholder="Choose scorecard" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  {scorecards.map((scorecard) => (
                    <SelectItem key={scorecard.id} value={scorecard.id}>
                      {scorecard.name}
                      {scorecard.isDefault ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex justify-end">
              <Button
                type="button"
                loading={saving}
                disabled={!canStart}
                onClick={() => void onStart()}
              >
                <PhoneOutgoing />
                Start call
              </Button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="hidden lg:block">
            <p className="text-sm font-medium text-foreground">What happens</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Your chosen agent calls the location phone number.</li>
              <li>The call is scored against the scorecard you selected.</li>
              <li>The call is recorded and transcribed automatically.</li>
              <li>When the call ends, it appears on Review for scoring.</li>
            </ul>
          </SurfacePanel>
        </div>
      )}
    </AppPage>
  )
}
