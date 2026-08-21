export const PRICING_CURRENCY = "gbp" as const
export const SETUP_FEE_PENCE = 75_000
export const INTENSIVE_UPLIFT = 0.6
export const ANNUAL_MONTHS_CHARGED = 10
export const MAX_INVOICE_ADJUSTMENT_PERCENT = 10
export const AUDIT_CALL_CAP = 10
export const MIN_DAYS_BETWEEN_CALLS = 3
export const PAST_DUE_PAUSE_DAYS = 7

export type SubscriptionTier = "local" | "growth" | "scale" | "brand"
export type SubscriptionCadence = "weekly" | "intensive"
export type BillingPeriod = "monthly" | "annual"

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
    id: "local",
    name: "Local",
    minLocations: 2,
    maxLocations: 6,
    monthlyPence: 19_900,
    perLocationMonthlyPence: null,
  },
  growth: {
    id: "growth",
    name: "Growth",
    minLocations: 7,
    maxLocations: 15,
    monthlyPence: 54_900,
    perLocationMonthlyPence: null,
  },
  scale: {
    id: "scale",
    name: "Scale",
    minLocations: 16,
    maxLocations: 40,
    monthlyPence: 129_900,
    perLocationMonthlyPence: null,
  },
  brand: {
    id: "brand",
    name: "Brand",
    minLocations: 41,
    maxLocations: null,
    monthlyPence: null,
    perLocationMonthlyPence: 4_000,
  },
}

export const STRIPE_PRICE_KEYS = [
  "local_monthly",
  "growth_monthly",
  "scale_monthly",
  "brand_monthly",
  "local_annual",
  "growth_annual",
  "scale_annual",
  "brand_annual",
  "setup_fee",
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
  billingPeriod: BillingPeriod,
): StripePriceKey {
  return `${tier}_${billingPeriod}` as StripePriceKey
}

export function annualAmountPence(monthlyPence: number) {
  return monthlyPence * ANNUAL_MONTHS_CHARGED
}

export function tierQuantity(tier: SubscriptionTier, locationQuantity: number) {
  if (tier !== "brand") return 1
  return Math.max(1, Math.round(locationQuantity) || 1)
}

export function clampAdjustmentPercent(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(MAX_INVOICE_ADJUSTMENT_PERCENT, parsed)
}

export function buildInvoicePreview(
  input: InvoicePreviewInput,
): InvoicePreview {
  const definition = TIERS[input.tier]
  const quantity = tierQuantity(input.tier, input.locationQuantity)
  const unitMonthly =
    input.tier === "brand"
      ? (definition.perLocationMonthlyPence ?? 0)
      : (definition.monthlyPence ?? 0)
  const unitAmountPence =
    input.billingPeriod === "annual"
      ? annualAmountPence(unitMonthly)
      : unitMonthly
  const basePence = unitAmountPence * quantity
  const intensive = input.cadence === "intensive"
  const intensivePence = intensive ? Math.round(basePence * INTENSIVE_UPLIFT) : 0
  const setupFeeWaived = input.billingPeriod === "annual"
  const includesSetupFee = input.isFirstInvoice && !setupFeeWaived
  const setupPence = includesSetupFee ? SETUP_FEE_PENCE : 0

  const periodLabel = input.billingPeriod === "annual" ? "year" : "month"
  const lines: InvoiceLine[] = [
    {
      key: "tier",
      description:
        input.tier === "brand"
          ? `${definition.name} (${quantity} location${quantity === 1 ? "" : "s"}) / ${periodLabel}`
          : `${definition.name} / ${periodLabel}`,
      quantity,
      unitAmountPence,
      amountPence: basePence,
      stripePriceKey: stripePriceKeyFor(input.tier, input.billingPeriod),
    },
  ]

  if (intensive) {
    lines.push({
      key: "intensive",
      description: "Intensive cadence (2x weekly)",
      quantity: 1,
      unitAmountPence: intensivePence,
      amountPence: intensivePence,
      stripePriceKey: null,
    })
  }

  if (includesSetupFee) {
    lines.push({
      key: "setup",
      description: "Setup fee",
      quantity: 1,
      unitAmountPence: SETUP_FEE_PENCE,
      amountPence: SETUP_FEE_PENCE,
      stripePriceKey: "setup_fee",
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
      key: "adjustment",
      description: "Adjustment",
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

export function cadenceCallsPerWeek(cadence: SubscriptionCadence | null) {
  return cadence === "intensive" ? 2 : 1
}
