import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarBlank, PhoneOutgoing, WarningCircle } from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  preventDialogDismissForPortals,
} from '@/components/ui/dialog'
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

export function NewCallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
    if (!open) return
    setMode('now')
    setRetryAfterMinutes(0)
    setLocalTime('10:00')
    setCalendarOpen(false)
    setActionError(null)
    setLocationId('')
    setScenarioId('')
    setScorecardId('')
  }, [open])

  useEffect(() => {
    if (!open || locationId || !locations[0]?.id) return
    setLocationId(locations[0].id)
  }, [locationId, locations, open])

  useEffect(() => {
    if (!open || scenarioId) return
    if (defaultAgent?.approved) {
      setScenarioId(defaultAgent.id)
    } else if (approvedAgents[0]?.id) {
      setScenarioId(approvedAgents[0].id)
    }
  }, [approvedAgents, defaultAgent, open, scenarioId])

  useEffect(() => {
    if (!open || scorecardId) return
    if (defaultScorecard?.id) {
      setScorecardId(defaultScorecard.id)
    } else if (scorecards[0]?.id) {
      setScorecardId(scorecards[0].id)
    }
  }, [defaultScorecard, open, scorecardId, scorecards])

  useEffect(() => {
    if (!open || !locationId) return
    setDate(dateKeyInZone(new Date(), timeZone))
  }, [locationId, open, timeZone])

  const canSubmit =
    Boolean(locationId) &&
    Boolean(scenarioId) &&
    Boolean(scorecardId) &&
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
      onOpenChange(false)
      navigate('/schedule')
      return
    }

    const result = await createCall({ locationId, scenarioId, scorecardId })
    if (result.error) {
      setActionError(result.error)
      return
    }
    onOpenChange(false)
    navigate('/review')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        onPointerDownOutside={preventDialogDismissForPortals}
        onFocusOutside={preventDialogDismissForPortals}
      >
        <div className="flex max-h-[calc(100svh-2rem)] min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>New call</DialogTitle>
            <DialogDescription>
              Call a location now, or schedule it for later.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error || actionError ? (
              <Alert variant="destructive">
                <WarningCircle weight="fill" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{actionError || error}</AlertDescription>
              </Alert>
            ) : null}

            {!canCreate ? (
              <p className="text-sm text-muted-foreground">
                Only owners, admins, and coaches can start mystery-shop calls.
              </p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : locations.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add a location before GhostShopper can place a call.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate('/locations')
                  }}
                >
                  Go to locations
                </Button>
              </div>
            ) : (
              <>
                {approvedAgents.length === 0 ? (
                  <Alert>
                    <WarningCircle />
                    <AlertTitle>No approved agents</AlertTitle>
                    <AlertDescription>
                      Create and approve an agent before starting a call.
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
                            <SelectItem
                              key={item.value}
                              value={String(item.value)}
                            >
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {canCreate && locations.length > 0 ? (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={saving || scheduling}
                disabled={!canSubmit}
                onClick={() => void onStart()}
              >
                {mode === 'later' ? <CalendarBlank /> : <PhoneOutgoing />}
                {mode === 'later' ? 'Schedule call' : 'Start call'}
              </Button>
            </DialogFooter>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
