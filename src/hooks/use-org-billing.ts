import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invokeFunction } from '@/lib/invoke-function'
import { supabase } from '@/lib/supabase/client'
import {
  buildInvoicePreview,
  clampAdjustmentPercent,
  suggestedTier,
  TIERS,
  type BillingPeriod,
  type BillingSubscriptionStatus,
  type OrgSubscriptionStatus,
  type SubscriptionCadence,
  type SubscriptionTier,
} from '@/lib/pricing'

export interface OrgSubscription {
  id: string
  orgId: string
  tier: SubscriptionTier
  cadence: SubscriptionCadence
  billingPeriod: BillingPeriod
  status: BillingSubscriptionStatus
  locationQuantity: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  setupFeeStatus: 'pending' | 'charged' | 'waived'
  firstInvoiceRaisedAt: string | null
}

export interface OrgInvoice {
  id: string
  status: string
  hostedInvoiceUrl: string | null
  amountDuePence: number
  amountPaidPence: number
  includesSetupFee: boolean
  intensive: boolean
  adjustmentPercent: number | null
  createdAt: string
  paidAt: string | null
}

function mapSubscription(row: Record<string, unknown>): OrgSubscription {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    tier: row.tier as SubscriptionTier,
    cadence: row.cadence as SubscriptionCadence,
    billingPeriod: row.billing_period as BillingPeriod,
    status: row.status as BillingSubscriptionStatus,
    locationQuantity: Number(row.location_quantity) || 0,
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    setupFeeStatus: (row.setup_fee_status as OrgSubscription['setupFeeStatus']) ??
      'pending',
    firstInvoiceRaisedAt:
      (row.first_invoice_raised_at as string | null) ?? null,
  }
}

function mapInvoice(row: Record<string, unknown>): OrgInvoice {
  return {
    id: row.id as string,
    status: row.status as string,
    hostedInvoiceUrl: (row.hosted_invoice_url as string | null) ?? null,
    amountDuePence: Number(row.amount_due_pence) || 0,
    amountPaidPence: Number(row.amount_paid_pence) || 0,
    includesSetupFee: Boolean(row.includes_setup_fee),
    intensive: Boolean(row.intensive),
    adjustmentPercent:
      row.adjustment_percent == null ? null : Number(row.adjustment_percent),
    createdAt: row.created_at as string,
    paidAt: (row.paid_at as string | null) ?? null,
  }
}

export function useOrgBilling(
  orgId: string | undefined,
  options?: {
    locationCount?: number
    orgStatus?: OrgSubscriptionStatus
  }
) {
  const [loading, setLoading] = useState(Boolean(orgId))
  const [saving, setSaving] = useState(false)
  const [raising, setRaising] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null)
  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [orgStatus, setOrgStatus] = useState<OrgSubscriptionStatus>(
    options?.orgStatus ?? 'audit'
  )

  const [tier, setTier] = useState<SubscriptionTier>('local')
  const [cadence, setCadence] = useState<SubscriptionCadence>('weekly')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [adjustmentPercent, setAdjustmentPercent] = useState('')

  const locationCount = options?.locationCount ?? 0
  const locationCountRef = useRef(locationCount)
  locationCountRef.current = locationCount

  const refresh = useCallback(async () => {
    if (!orgId) {
      setSubscription(null)
      setInvoices([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [subRes, invoiceRes, orgRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select(
          'id, org_id, tier, cadence, billing_period, status, location_quantity, current_period_start, current_period_end, setup_fee_status, first_invoice_raised_at'
        )
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select(
          'id, status, hosted_invoice_url, amount_due_pence, amount_paid_pence, includes_setup_fee, intensive, adjustment_percent, created_at, paid_at'
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('orgs')
        .select('subscription_status')
        .eq('id', orgId)
        .maybeSingle(),
    ])

    const firstError =
      subRes.error?.message || invoiceRes.error?.message || orgRes.error?.message
    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    const mapped = subRes.data
      ? mapSubscription(subRes.data as Record<string, unknown>)
      : null
    setSubscription(mapped)
    setInvoices((invoiceRes.data ?? []).map((row) => mapInvoice(row as Record<string, unknown>)))
    setOrgStatus(
      (orgRes.data?.subscription_status as OrgSubscriptionStatus | undefined) ??
        'audit'
    )

    if (mapped) {
      setTier(mapped.tier)
      setCadence(mapped.cadence)
      setBillingPeriod(mapped.billingPeriod)
    } else {
      setTier(suggestedTier(locationCountRef.current))
      setCadence('weekly')
      setBillingPeriod('monthly')
    }

    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isFirstInvoice = !subscription?.firstInvoiceRaisedAt
  const locationQuantity =
    tier === 'brand'
      ? Math.max(locationCount, subscription?.locationQuantity || 0, 1)
      : locationCount

  const preview = useMemo(
    () =>
      buildInvoicePreview({
        tier,
        cadence,
        billingPeriod,
        locationQuantity,
        isFirstInvoice,
        adjustmentPercent: clampAdjustmentPercent(adjustmentPercent),
      }),
    [adjustmentPercent, billingPeriod, cadence, isFirstInvoice, locationQuantity, tier]
  )

  const dirty = useMemo(() => {
    if (!subscription) return true
    return (
      subscription.tier !== tier ||
      subscription.cadence !== cadence ||
      subscription.billingPeriod !== billingPeriod
    )
  }, [billingPeriod, cadence, subscription, tier])

  const saveSubscription = useCallback(async () => {
    if (!orgId) return { error: 'Organisation not found.' }
    setSaving(true)
    setError(null)
    const { data, error: invokeError } = await invokeFunction<{
      error?: string
      subscription?: Record<string, unknown>
    }>('admin-billing', {
      action: 'save_subscription',
      orgId,
      tier,
      cadence,
      billingPeriod,
      locationQuantity,
    })
    setSaving(false)
    if (invokeError) {
      setError(invokeError)
      return { error: invokeError }
    }
    if (data?.subscription) {
      setSubscription(mapSubscription(data.subscription))
    }
    return { error: null }
  }, [billingPeriod, cadence, locationQuantity, orgId, tier])

  const raiseInvoice = useCallback(async () => {
    if (!orgId) return { error: 'Organisation not found.' }
    setRaising(true)
    setError(null)
    const { data, error: invokeError } = await invokeFunction<{
      error?: string
      invoice?: Record<string, unknown>
      hostedInvoiceUrl?: string | null
      emailedTo?: string | null
      emailError?: string | null
    }>('admin-billing', {
      action: 'raise_invoice',
      orgId,
      adjustmentPercent: clampAdjustmentPercent(adjustmentPercent),
    })
    setRaising(false)
    if (invokeError) {
      setError(invokeError)
      return { error: invokeError }
    }
    if (data?.invoice) {
      setInvoices((current) => [
        mapInvoice(data.invoice as Record<string, unknown>),
        ...current,
      ])
    }
    setAdjustmentPercent('')
    await refresh()
    return {
      error: null,
      hostedInvoiceUrl: data?.hostedInvoiceUrl ?? null,
      emailedTo: data?.emailedTo ?? null,
      emailError: data?.emailError ?? null,
    }
  }, [adjustmentPercent, orgId, refresh])

  const bandWarning = useMemo(() => {
    const max = TIERS[tier].maxLocations
    const min = TIERS[tier].minLocations
    if (max != null && locationCount > max) {
      return `${TIERS[tier].name} covers up to ${max} locations. This org has ${locationCount}.`
    }
    if (locationCount > 0 && locationCount < min) {
      return `${TIERS[tier].name} is intended for ${min}${max ? ` to ${max}` : '+'} locations. This org has ${locationCount}.`
    }
    return null
  }, [locationCount, tier])

  return {
    loading,
    saving,
    raising,
    error,
    subscription,
    invoices,
    orgStatus,
    tier,
    setTier,
    cadence,
    setCadence,
    billingPeriod,
    setBillingPeriod,
    adjustmentPercent,
    setAdjustmentPercent,
    preview,
    dirty,
    isFirstInvoice,
    locationCount,
    locationQuantity,
    bandWarning,
    saveSubscription,
    raiseInvoice,
    refresh,
  }
}
