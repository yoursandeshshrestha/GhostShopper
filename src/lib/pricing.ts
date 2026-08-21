export const PRICING_CURRENCY = 'gbp' as const
export const SETUP_FEE_PENCE = 75_000
export const INTENSIVE_UPLIFT = 0.6
export const ANNUAL_MONTHS_CHARGED = 10
export const MAX_INVOICE_ADJUSTMENT_PERCENT = 10
export const AUDIT_CALL_CAP = 10
export const MIN_DAYS_BETWEEN_CALLS = 3
export const PAST_DUE_PAUSE_DAYS = 7

export type SubscriptionTier = 'local' | 'growth' | 'scale' | 'brand'
export type SubscriptionCadence = 'weekly' | 'intensive'
export type BillingPeriod = 'monthly' | 'annual'
export type OrgSubscriptionStatus = 'audit' | 'active' | 'past_due' | 'cancelled'
export type BillingSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'cancelled'

export interface TierDefinition {
  id: SubscriptionTier
  name: string
  minLocations: number
  maxLocations: number | null
  monthlyPence: number | null
  perLocationMonthlyPence: number | null
}

export const TIERS: Record<SubscriptionTier, TierDefinition> = {
  local: {
    id: 'local',
    name: 'Local',
    minLocations: 2,
    maxLocations: 6,
    monthlyPence: 19_900,
    perLocationMonthlyPence: null,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    minLocations: 7,
    maxLocations: 15,
    monthlyPence: 54_900,
    perLocationMonthlyPence: null,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    minLocations: 16,
    maxLocations: 40,
    monthlyPence: 129_900,
    perLocationMonthlyPence: null,
  },
  brand: {
    id: 'brand',
    name: 'Brand',
    minLocations: 41,
    maxLocations: null,
    monthlyPence: null,
    perLocationMonthlyPence: 4_000,
  },
}

export const TIER_ORDER: SubscriptionTier[] = [
  'local',
  'growth',
  'scale',
  'brand',
]

export const STRIPE_PRICE_KEYS = [
  'local_monthly',
  'growth_monthly',
  'scale_monthly',
  'brand_monthly',
  'local_annual',
  'growth_annual',
  'scale_annual',
  'brand_annual',
  'setup_fee',
] as const

export type StripePriceKey = (typeof STRIPE_PRICE_KEYS)[number]

export interface InvoiceLine {
  key: string
  description: string
  quantity: number
  unitAmountPence: number
  amountPence: number
  stripePriceKey: StripePriceKey | null
}

export interface InvoicePreviewInput {
  tier: SubscriptionTier
  billingPeriod: BillingPeriod
  cadence: SubscriptionCadence
  locationQuantity: number
  isFirstInvoice: boolean
  adjustmentPercent?: number | null
}

export interface InvoicePreview {
  lines: InvoiceLine[]
  subtotalPence: number
  adjustmentPence: number
  totalPence: number
  includesSetupFee: boolean
  setupFeeWaived: boolean
  intensive: boolean
  stripePriceKey: StripePriceKey
}

export function stripePriceKeyFor(
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod
): StripePriceKey {
  return `${tier}_${billingPeriod}` as StripePriceKey
}

export function annualAmountPence(monthlyPence: number) {
  return monthlyPence * ANNUAL_MONTHS_CHARGED
}

export function tierBasePence(
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod,
  locationQuantity: number
) {
  const definition = TIERS[tier]
  const quantity = Math.max(1, Math.round(locationQuantity) || 1)

  if (tier === 'brand') {
    const monthly = (definition.perLocationMonthlyPence ?? 0) * quantity
    return billingPeriod === 'annual' ? annualAmountPence(monthly) : monthly
  }

  const monthly = definition.monthlyPence ?? 0
  return billingPeriod === 'annual' ? annualAmountPence(monthly) : monthly
}

export function tierQuantity(
  tier: SubscriptionTier,
  locationQuantity: number
) {
  if (tier !== 'brand') return 1
  return Math.max(1, Math.round(locationQuantity) || 1)
}

export function clampAdjustmentPercent(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(MAX_INVOICE_ADJUSTMENT_PERCENT, parsed)
}

export function buildInvoicePreview(
  input: InvoicePreviewInput
): InvoicePreview {
  const definition = TIERS[input.tier]
  const quantity = tierQuantity(input.tier, input.locationQuantity)
  const unitMonthly =
    input.tier === 'brand'
      ? (definition.perLocationMonthlyPence ?? 0)
      : (definition.monthlyPence ?? 0)
  const unitAmountPence =
    input.billingPeriod === 'annual'
      ? annualAmountPence(unitMonthly)
      : unitMonthly
  const basePence = unitAmountPence * quantity
  const intensive = input.cadence === 'intensive'
  const intensivePence = intensive ? Math.round(basePence * INTENSIVE_UPLIFT) : 0
  const setupFeeWaived = input.billingPeriod === 'annual'
  const includesSetupFee = input.isFirstInvoice && !setupFeeWaived
  const setupPence = includesSetupFee ? SETUP_FEE_PENCE : 0

  const periodLabel = input.billingPeriod === 'annual' ? 'year' : 'month'
  const lines: InvoiceLine[] = [
    {
      key: 'tier',
      description:
        input.tier === 'brand'
          ? `${definition.name} (${quantity} location${quantity === 1 ? '' : 's'}) / ${periodLabel}`
          : `${definition.name} / ${periodLabel}`,
      quantity,
      unitAmountPence,
      amountPence: basePence,
      stripePriceKey: stripePriceKeyFor(input.tier, input.billingPeriod),
    },
  ]

  if (intensive) {
    lines.push({
      key: 'intensive',
      description: 'Intensive cadence (2x weekly)',
      quantity: 1,
      unitAmountPence: intensivePence,
      amountPence: intensivePence,
      stripePriceKey: null,
    })
  }

  if (includesSetupFee) {
    lines.push({
      key: 'setup',
      description: 'Setup fee',
      quantity: 1,
      unitAmountPence: SETUP_FEE_PENCE,
      amountPence: SETUP_FEE_PENCE,
      stripePriceKey: 'setup_fee',
    })
  }

  const billablePence = basePence + intensivePence + setupPence
  const adjustmentPercent = clampAdjustmentPercent(input.adjustmentPercent)
  const adjustmentPence =
    adjustmentPercent > 0
      ? Math.round(billablePence * (adjustmentPercent / 100))
      : 0

  if (adjustmentPence > 0) {
    lines.push({
      key: 'adjustment',
      description: 'Adjustment',
      quantity: 1,
      unitAmountPence: -adjustmentPence,
      amountPence: -adjustmentPence,
      stripePriceKey: null,
    })
  }

  return {
    lines,
    subtotalPence: billablePence,
    adjustmentPence,
    totalPence: billablePence - adjustmentPence,
    includesSetupFee,
    setupFeeWaived: input.isFirstInvoice && setupFeeWaived,
    intensive,
    stripePriceKey: stripePriceKeyFor(input.tier, input.billingPeriod),
  }
}

export function suggestedTier(locationCount: number): SubscriptionTier {
  if (locationCount >= TIERS.brand.minLocations) return 'brand'
  if (locationCount >= TIERS.scale.minLocations) return 'scale'
  if (locationCount >= TIERS.growth.minLocations) return 'growth'
  return 'local'
}

export function locationBandExceeded(
  tier: SubscriptionTier,
  locationCount: number
) {
  const max = TIERS[tier].maxLocations
  if (max == null) return false
  return locationCount > max
}

export function cadenceCallsPerWeek(cadence: SubscriptionCadence | null) {
  return cadence === 'intensive' ? 2 : 1
}

export const PRICING_FIXTURES = [
  {
    name: '3-branch letting agency, monthly',
    input: {
      tier: 'local' as const,
      billingPeriod: 'monthly' as const,
      cadence: 'weekly' as const,
      locationQuantity: 3,
      isFirstInvoice: true,
    },
    firstInvoicePence: 94_900,
    ongoingPence: 19_900,
  },
  {
    name: '12-location dental group, monthly',
    input: {
      tier: 'growth' as const,
      billingPeriod: 'monthly' as const,
      cadence: 'weekly' as const,
      locationQuantity: 12,
      isFirstInvoice: true,
    },
    firstInvoicePence: 129_900,
    ongoingPence: 54_900,
  },
  {
    name: '30-site garage group, annual',
    input: {
      tier: 'scale' as const,
      billingPeriod: 'annual' as const,
      cadence: 'weekly' as const,
      locationQuantity: 30,
      isFirstInvoice: true,
    },
    firstInvoicePence: 1_299_000,
    ongoingPence: 1_299_000,
  },
  {
    name: '120-location franchise, monthly, intensive',
    input: {
      tier: 'brand' as const,
      billingPeriod: 'monthly' as const,
      cadence: 'intensive' as const,
      locationQuantity: 120,
      isFirstInvoice: true,
    },
    firstInvoicePence: 843_000,
    ongoingPence: 768_000,
  },
  {
    name: '55-location brand, annual',
    input: {
      tier: 'brand' as const,
      billingPeriod: 'annual' as const,
      cadence: 'weekly' as const,
      locationQuantity: 55,
      isFirstInvoice: true,
    },
    firstInvoicePence: 2_200_000,
    ongoingPence: 2_200_000,
  },
] as const

export function locationBandErrorMessage(error: string | null | undefined) {
  if (!error) return null
  if (!error.includes('LOCATION_BAND_EXCEEDED')) return null
  return error.replace(/^.*LOCATION_BAND_EXCEEDED:\s*/, '').trim() || error
}

export function assertPricingFixtures() {
  for (const fixture of PRICING_FIXTURES) {
    const first = buildInvoicePreview(fixture.input)
    if (first.totalPence !== fixture.firstInvoicePence) {
      throw new Error(
        `${fixture.name}: first invoice expected ${fixture.firstInvoicePence}, got ${first.totalPence}`
      )
    }
    const ongoing = buildInvoicePreview({
      ...fixture.input,
      isFirstInvoice: false,
    })
    if (ongoing.totalPence !== fixture.ongoingPence) {
      throw new Error(
        `${fixture.name}: ongoing expected ${fixture.ongoingPence}, got ${ongoing.totalPence}`
      )
    }
  }
}
