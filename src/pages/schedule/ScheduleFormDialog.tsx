import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
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
import {
  dateKeyInZone,
  zonedLocalToUtc,
  CALL_FREQUENCIES,
  RETRY_DELAY_OPTIONS,
  type CallFrequency,
} from '@/lib/schedule-time'
import { cn } from '@/lib/utils'
import type { CallScheduleKind, OrgCallSchedule } from '@/types/schedule'
import type {
  ScheduleAgentOption,
  ScheduleLocationOption,
  ScheduleScorecardOption,
} from '@/hooks/use-schedules'

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

function parseCalendarDate(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return zonedLocalToUtc(value, '12:00', timeZone)
}

function startOfTodayInZone(timeZone: string) {
  return zonedLocalToUtc(dateKeyInZone(new Date(), timeZone), '00:00', timeZone)
}

export function ScheduleFormDialog({
  open,
  saving,
  locations,
  agents,
  scorecards,
  defaultLocationId,
  defaultScenarioId,
  defaultScorecardId,
  schedule,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  saving: boolean
  locations: ScheduleLocationOption[]
  agents: ScheduleAgentOption[]
  scorecards: ScheduleScorecardOption[]
  defaultLocationId?: string
  defaultScenarioId?: string
  defaultScorecardId?: string
  schedule?: OrgCallSchedule | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    locationId: string
    scenarioId: string
    scorecardId: string
    kind: CallScheduleKind
    frequency: CallFrequency | null
    date: string
    localTime: string
    retryAfterMinutes: number | null
  }) => Promise<string | null>
}) {
  const approvedAgents = useMemo(
    () => agents.filter((agent) => agent.approved),
    [agents]
  )

  const [kind, setKind] = useState<CallScheduleKind>('recurring')
  const [locationId, setLocationId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [scorecardId, setScorecardId] = useState('')
  const [frequency, setFrequency] = useState<CallFrequency>('Weekly')
  const [date, setDate] = useState('')
  const [localTime, setLocalTime] = useState('10:00')
  const [retryAfterMinutes, setRetryAfterMinutes] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const selectedLocation = locations.find((item) => item.id === locationId)
  const timeZone = selectedLocation?.timezone || 'UTC'

  useEffect(() => {
    if (!open) return
    setFormError(null)
    setCalendarOpen(false)
    if (schedule) {
      setKind(schedule.kind)
      setLocationId(schedule.locationId)
      setScenarioId(schedule.scenarioId || approvedAgents[0]?.id || '')
      setScorecardId(schedule.scorecardId || scorecards[0]?.id || '')
      setFrequency(schedule.frequency ?? 'Weekly')
      setLocalTime(schedule.localTime)
      setRetryAfterMinutes(schedule.retryAfterMinutes ?? 0)
      setDate(dateKeyInZone(new Date(schedule.nextRunAt), schedule.timezone))
      return
    }
    setKind('recurring')
    setLocationId(defaultLocationId || locations[0]?.id || '')
    setScenarioId(defaultScenarioId || approvedAgents[0]?.id || '')
    setScorecardId(defaultScorecardId || scorecards[0]?.id || '')
    setLocalTime('10:00')
    setRetryAfterMinutes(0)
  }, [
    approvedAgents,
    defaultLocationId,
    defaultScenarioId,
    defaultScorecardId,
    locations,
    open,
    schedule,
    scorecards,
  ])

  useEffect(() => {
    if (!open || !locationId) return
    if (schedule && locationId === schedule.locationId) return
    const location = locations.find((item) => item.id === locationId)
    const nextFrequency = CALL_FREQUENCIES.find(
      (item) => item === location?.callFrequency
    )
    if (nextFrequency) setFrequency(nextFrequency)
    setDate(dateKeyInZone(new Date(), location?.timezone || 'UTC'))
  }, [locationId, locations, open, schedule])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const error = await onSubmit({
      locationId,
      scenarioId,
      scorecardId,
      kind,
      frequency: kind === 'recurring' ? frequency : null,
      date,
      localTime,
      retryAfterMinutes: retryAfterMinutes > 0 ? retryAfterMinutes : null,
    })
    if (error) {
      setFormError(error)
      return
    }
    onOpenChange(false)
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
            <DialogTitle>
              {schedule ? 'Edit schedule' : 'Schedule a call'}
            </DialogTitle>
            <DialogDescription>
              {schedule
                ? 'Change cadence, time, agent, scorecard, or retry after a missed call.'
                : 'GhostShopper will call this location automatically at the time you choose, in the location timezone.'}
            </DialogDescription>
          </DialogHeader>

          <form
            id="schedule-form"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <Tabs
              value={kind}
              onValueChange={(value) => setKind(value as CallScheduleKind)}
            >
              <TabsList>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
                <TabsTrigger value="one_off">One-off</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-2 sm:col-span-2">
                <FieldLabel>Location</FieldLabel>
                <Select
                  value={locationId || undefined}
                  onValueChange={(value) => setLocationId(value ?? '')}
                >
                  <SelectTrigger
                    className={cn(
                      fieldControlClassName,
                      'justify-between dark:bg-transparent dark:hover:bg-transparent'
                    )}
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
                    className={cn(
                      fieldControlClassName,
                      'justify-between dark:bg-transparent dark:hover:bg-transparent'
                    )}
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
                    className={cn(
                      fieldControlClassName,
                      'justify-between dark:bg-transparent dark:hover:bg-transparent'
                    )}
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

              {kind === 'recurring' ? (
                <Field className="gap-2 sm:col-span-2">
                  <FieldLabel>Frequency</FieldLabel>
                  <Select
                    value={frequency}
                    onValueChange={(value) =>
                      setFrequency((value as CallFrequency) ?? 'Weekly')
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        fieldControlClassName,
                        'justify-between dark:bg-transparent dark:hover:bg-transparent'
                      )}
                    >
                      <SelectValue placeholder="Choose frequency" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200]">
                      {CALL_FREQUENCIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <Field className="gap-2">
                <FieldLabel>
                  {kind === 'recurring' ? 'First call' : 'Date'}
                </FieldLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        fieldControlClassName,
                        'justify-start font-normal dark:bg-transparent dark:hover:bg-transparent'
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
                    className={cn(
                      fieldControlClassName,
                      'justify-between dark:bg-transparent dark:hover:bg-transparent'
                    )}
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

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="schedule-form" loading={saving}>
              {schedule ? 'Save schedule' : 'Schedule call'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
