export type CallFrequency = 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly'

export const CALL_FREQUENCIES: CallFrequency[] = [
  'Daily',
  'Weekly',
  'Bi-weekly',
  'Monthly',
]

/** Minutes to wait after miss / busy / voicemail. 0 = do not retry. */
export const RETRY_DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Do not retry' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: 'Next day' },
]

export function retryDelayLabel(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) return 'No retry'
  const match = RETRY_DELAY_OPTIONS.find((item) => item.value === minutes)
  return match?.label ?? `${minutes} min`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function partsInZone(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms))

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

export function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Convert a wall-clock date+time in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  date: string,
  time: string,
  timeZone: string
): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute)
  let ts = wanted

  for (let i = 0; i < 4; i += 1) {
    const got = partsInZone(ts, timeZone)
    const gotTs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute)
    const delta = wanted - gotTs
    if (delta === 0) break
    ts += delta
  }

  return new Date(ts)
}

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return formatDateKey(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate()
  )
}

export function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate()
  return formatDateKey(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    Math.min(day, lastDay)
  )
}

export function addFrequencyToDate(
  date: string,
  frequency: CallFrequency
): string {
  if (frequency === 'Daily') return addCalendarDays(date, 1)
  if (frequency === 'Weekly') return addCalendarDays(date, 7)
  if (frequency === 'Bi-weekly') return addCalendarDays(date, 14)
  return addCalendarMonths(date, 1)
}

export function dateKeyInZone(instant: Date, timeZone: string) {
  const parts = partsInZone(instant.getTime(), timeZone)
  return formatDateKey(parts.year, parts.month, parts.day)
}

export function nextOccurrence(input: {
  from?: Date
  date?: string
  localTime: string
  timeZone: string
  frequency?: CallFrequency | null
}): Date {
  const from = input.from ?? new Date()
  const startDate = input.date ?? dateKeyInZone(from, input.timeZone)
  let candidate = zonedLocalToUtc(startDate, input.localTime, input.timeZone)

  // An explicit calendar date is the first run the user picked — do not
  // silently roll it forward (e.g. Daily 10:00 becoming tomorrow).
  if (input.date || !input.frequency) {
    return candidate
  }

  let date = startDate
  let guard = 0
  while (candidate.getTime() <= from.getTime() && guard < 48) {
    date = addFrequencyToDate(date, input.frequency)
    candidate = zonedLocalToUtc(date, input.localTime, input.timeZone)
    guard += 1
  }

  return candidate
}

export function advanceSchedule(input: {
  lastDueAt: Date
  localTime: string
  timeZone: string
  frequency: CallFrequency
}): Date {
  const date = addFrequencyToDate(
    dateKeyInZone(input.lastDueAt, input.timeZone),
    input.frequency
  )
  return zonedLocalToUtc(date, input.localTime, input.timeZone)
}

export function localTimeFromInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '10:00'
  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  return `${pad(hour)}:${pad(minute)}`
}
