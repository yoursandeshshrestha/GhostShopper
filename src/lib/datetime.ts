function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function hasTimezoneSuffix(value: string): boolean {
  return /[zZ]|[+-]\d{2}:\d{2}$/.test(value)
}

/** Backend stores UTC datetimes as naive ISO strings — parse as UTC when no offset. */
export function parseDateTime(value: string | Date): Date {
  if (value instanceof Date) return value
  if (!value) return new Date(Number.NaN)

  if (isDateOnlyString(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const normalized = hasTimezoneSuffix(value)
    ? value
    : `${value.includes('T') ? value : value.replace(' ', 'T')}Z`

  return new Date(normalized)
}

export function resolveTimezone(timezone?: string | null): string {
  return timezone?.trim() || getBrowserTimezone()
}

function getZonedParts(
  value: string | Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options,
  }).formatToParts(parseDateTime(value))
}

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPart['type']
): string {
  return parts.find((part) => part.type === type)?.value ?? ''
}

/** e.g. "9 march 2028" */
export function formatDate(
  value: string | Date,
  timezone?: string | null
): string {
  const tz = resolveTimezone(timezone)
  const parts = getZonedParts(value, tz, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const day = partValue(parts, 'day')
  const month = partValue(parts, 'month').toLowerCase()
  const year = partValue(parts, 'year')
  return `${day} ${month} ${year}`
}

/** e.g. "9:00 AM" */
export function formatTime(
  value: string | Date,
  timezone?: string | null
): string {
  const tz = resolveTimezone(timezone)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parseDateTime(value))
}

/** e.g. "9:00 AM, 9 march 2028" */
export function formatDateTime(
  value: string | Date,
  timezone?: string | null
): string {
  return `${formatTime(value, timezone)}, ${formatDate(value, timezone)}`
}

/** Short date for tables — e.g. "9 mar 2028" */
export function formatDateShort(
  value: string | Date,
  timezone?: string | null
): string {
  const tz = resolveTimezone(timezone)
  const parts = getZonedParts(value, tz, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const day = partValue(parts, 'day')
  const month = partValue(parts, 'month').toLowerCase()
  const year = partValue(parts, 'year')
  return `${day} ${month} ${year}`
}

/** Table datetime — e.g. "9:00 AM, 9 mar 2028" */
export function formatDateTimeShort(
  value: string | Date,
  timezone?: string | null
): string {
  return `${formatTime(value, timezone)}, ${formatDateShort(value, timezone)}`
}

export function isValidDate(value: string | Date): boolean {
  return !Number.isNaN(parseDateTime(value).getTime())
}

export function formatDateTimeOrDash(
  value: string | Date | null | undefined,
  timezone?: string | null
): string {
  if (value == null || value === '') return '-'
  if (!isValidDate(value)) return '-'
  return formatDateTime(value, timezone)
}
