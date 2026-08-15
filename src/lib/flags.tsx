import { cn } from '@/lib/utils'

/** Maps IANA timezones to /public/flags country codes (from Thrumble). */
const TIMEZONE_TO_FLAG: Record<string, string> = {
  'Europe/London': 'gb',
  'Europe/Dublin': 'ie',
  'Europe/Paris': 'fr',
  'Europe/Berlin': 'de',
  'Europe/Amsterdam': 'nl',
  'Europe/Madrid': 'es',
  'Europe/Rome': 'it',
  'Europe/Stockholm': 'se',
  'Europe/Warsaw': 'pl',
  'America/New_York': 'us',
  'America/Chicago': 'us',
  'America/Denver': 'us',
  'America/Los_Angeles': 'us',
  'America/Toronto': 'ca',
  'America/Sao_Paulo': 'br',
  'Asia/Dubai': 'ae',
  'Asia/Kolkata': 'in',
  'Asia/Singapore': 'sg',
  'Asia/Tokyo': 'jp',
  'Asia/Shanghai': 'cn',
  'Australia/Sydney': 'au',
  'Australia/Melbourne': 'au',
  'Pacific/Auckland': 'nz',
  UTC: 'un',
}

const COUNTRY_TO_FLAG: Record<string, string> = {
  'United States': 'us',
  'United Kingdom': 'gb',
  Canada: 'ca',
  Australia: 'au',
  'New Zealand': 'nz',
  Ireland: 'ie',
  India: 'in',
  'United Arab Emirates': 'ae',
  Singapore: 'sg',
  Other: 'un',
}

const FALLBACK_FLAG = 'un'

export function getTimezoneFlagCode(timezone: string): string {
  if (!timezone) return FALLBACK_FLAG
  if (TIMEZONE_TO_FLAG[timezone]) return TIMEZONE_TO_FLAG[timezone]

  const city = timezone.split('/').pop()?.toLowerCase() ?? ''
  if (timezone.startsWith('America/')) {
    if (
      city.includes('toronto') ||
      city.includes('vancouver') ||
      city.includes('montreal')
    ) {
      return 'ca'
    }
    if (city.includes('sao') || city.includes('rio')) return 'br'
    return 'us'
  }
  if (timezone.startsWith('Europe/')) {
    if (city.includes('london')) return 'gb'
    if (city.includes('dublin')) return 'ie'
    if (city.includes('paris')) return 'fr'
    if (city.includes('berlin')) return 'de'
    return 'eu'
  }
  if (timezone.startsWith('Asia/')) {
    if (
      city.includes('kolkata') ||
      city.includes('calcutta') ||
      city.includes('mumbai')
    ) {
      return 'in'
    }
    if (city.includes('tokyo')) return 'jp'
    if (city.includes('shanghai') || city.includes('beijing')) return 'cn'
    if (city.includes('singapore')) return 'sg'
    if (city.includes('dubai')) return 'ae'
  }
  if (timezone.startsWith('Australia/')) return 'au'
  if (timezone.startsWith('Pacific/') && city.includes('auckland')) return 'nz'

  return FALLBACK_FLAG
}

export function getCountryFlagCode(country: string): string {
  if (!country) return FALLBACK_FLAG
  return COUNTRY_TO_FLAG[country] ?? FALLBACK_FLAG
}

export function getFlagSrc(code: string): string {
  return `/flags/${code || FALLBACK_FLAG}.svg`
}

export function Flag({
  code,
  alt,
  className,
}: {
  code: string
  alt?: string
  className?: string
}) {
  return (
    <img
      src={getFlagSrc(code)}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      className={cn('size-4 shrink-0 rounded-full object-cover', className)}
    />
  )
}

export function TimezoneFlag({
  timezone,
  className,
}: {
  timezone: string
  className?: string
}) {
  return <Flag code={getTimezoneFlagCode(timezone)} className={className} />
}

export function CountryFlag({
  country,
  className,
}: {
  country: string
  className?: string
}) {
  return <Flag code={getCountryFlagCode(country)} className={className} />
}
