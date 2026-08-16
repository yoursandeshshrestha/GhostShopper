import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarBlank, PhoneOutgoing, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfacePanel } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCalls } from '@/hooks/use-calls'
import { useSchedules } from '@/hooks/use-schedules'
import {
  dateKeyInZone,
  zonedLocalToUtc,
  RETRY_DELAY_OPTIONS,
} from '@/lib/schedule-time'
import { cn } from '@/lib/utils'

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

function parseCalendarDate(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return zonedLocalToUtc(value, '12:00', timeZone)
}

function startOfTodayInZone(timeZone: string) {
  return zonedLocalToUtc(dateKeyInZone(new Date(), timeZone), '00:00', timeZone)
}

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
  const { createSchedule, saving: scheduling } = useSchedules()

  const [mode, setMode] = useState<'now' | 'later'>('now')
  const [locationId, setLocationId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [scorecardId, setScorecardId] = useState('')
  const [date, setDate] = useState('')
  const [localTime, setLocalTime] = useState('10:00')
  const [retryAfterMinutes, setRetryAfterMinutes] = useState(0)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const approvedAgents = useMemo(
    () => agents.filter((agent) => agent.approved),
    [agents]
  )
  const selectedLocation = locations.find((item) => item.id === locationId)
  const timeZone = selectedLocation?.timezone || 'UTC'

  useEffect(() => {
    if (!locationId && locations[0]?.id) {
      setLocationId(locations[0].id)
    }
  }, [locationId, locations])

  useEffect(() => {
    if (!scenarioId && defaultAgent?.approved) {
      setScenarioId(defaultAgent.id)
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

  useEffect(() => {
    if (!locationId) return
    setDate(dateKeyInZone(new Date(), timeZone))
  }, [locationId, timeZone])

  const canSubmit =
    Boolean(locationId) && Boolean(scenarioId) && Boolean(scorecardId) &&
    (mode === 'now' || (Boolean(date) && Boolean(localTime)))

  async function onStart() {
    setActionError(null)
    if (mode === 'later') {
      const result = await createSchedule({
        locationId,
        scenarioId,
        scorecardId,
        kind: 'one_off',
        frequency: null,
        date,
        localTime,
        timezone: timeZone,
        retryAfterMinutes: retryAfterMinutes > 0 ? retryAfterMinutes : null,
      })
      if (result.error) {
        setActionError(result.error)
        return
      }
      navigate('/schedule')
      return
    }

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

            <Tabs
              value={mode}
              onValueChange={(value) => setMode(value as 'now' | 'later')}
            >
              <TabsList>
                <TabsTrigger value="now">Call now</TabsTrigger>
                <TabsTrigger value="later">Schedule</TabsTrigger>
              </TabsList>
            </Tabs>

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

            {mode === 'later' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel>Date</FieldLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          fieldControlClassName,
                          'justify-start font-normal'
                        )}
                      >
                        <CalendarBlank className="size-4" />
                        {date || 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        timeZone={timeZone}
                        selected={parseCalendarDate(date, timeZone)}
                        onSelect={(next) => {
                          if (!next) return
                          setDate(dateKeyInZone(next, timeZone))
                          setCalendarOpen(false)
                        }}
                        disabled={{
                          before: startOfTodayInZone(timeZone),
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
                <Field className="gap-2">
                  <FieldLabel>Time ({timeZone})</FieldLabel>
                  <Input
                    type="time"
                    value={localTime}
                    onChange={(event) => setLocalTime(event.target.value)}
                    className={fieldControlClassName}
                  />
                </Field>
                <Field className="gap-2 sm:col-span-2">
                  <FieldLabel>If missed, busy, or voicemail</FieldLabel>
                  <Select
                    value={String(retryAfterMinutes)}
                    onValueChange={(value) =>
                      setRetryAfterMinutes(Number(value) || 0)
                    }
                  >
                    <SelectTrigger
                      className={cn(fieldControlClassName, 'justify-between')}
                    >
                      <SelectValue placeholder="Retry delay" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200]">
                      {RETRY_DELAY_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={String(item.value)}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                loading={saving || scheduling}
                disabled={!canSubmit}
                onClick={() => void onStart()}
              >
                {mode === 'later' ? <CalendarBlank /> : <PhoneOutgoing />}
                {mode === 'later' ? 'Schedule call' : 'Start call'}
              </Button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="hidden lg:block">
            <p className="text-sm font-medium text-foreground">What happens</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {mode === 'later' ? (
                <>
                  <li>The call is queued for the date and time you pick.</li>
                  <li>Time is in the location timezone ({timeZone}).</li>
                  <li>When it is due, GhostShopper dials automatically.</li>
                  <li>If nobody answers, you can retry after the delay you pick.</li>
                  <li>You can pause, edit, or cancel it from the Schedule page.</li>
                </>
              ) : (
                <>
                  <li>Your chosen agent calls the location phone number.</li>
                  <li>The call is scored against the scorecard you selected.</li>
                  <li>The call is recorded and transcribed automatically.</li>
                  <li>When the call ends, it appears on Review for scoring.</li>
                </>
              )}
            </ul>
          </SurfacePanel>
        </div>
      )}
    </AppPage>
  )
}
