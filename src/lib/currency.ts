const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
})

export function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '$0.00'
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return usdFormatter.format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatGbp(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '£0.00'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatGbpPence(pence: number | null | undefined) {
  if (pence == null || !Number.isFinite(pence)) return formatGbp(0)
  return formatGbp(pence / 100)
}

export function parseUsd(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
