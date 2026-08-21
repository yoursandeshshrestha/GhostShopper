import { useState } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { SurfaceCard } from '@/components/layout/AppPage'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOrgBilling } from '@/hooks/use-org-billing'
import { formatGbpPence } from '@/lib/currency'
import { formatDateTimeShort } from '@/lib/datetime'
import {
  TIERS,
  TIER_ORDER,
  type BillingPeriod,
  type OrgSubscriptionStatus,
  type SubscriptionCadence,
  type SubscriptionTier,
} from '@/lib/pricing'
import { cn } from '@/lib/utils'

function BillingCombobox({
  id,
  label,
  items,
  value,
  placeholder,
  emptyLabel,
  displayValue,
  itemLabel,
  onChange,
}: {
  id: string
  label: string
  items: readonly string[]
  value: string
  placeholder: string
  emptyLabel: string
  displayValue: (value: string) => string
  itemLabel: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        items={[...items]}
        value={value || null}
        onValueChange={(next) => onChange(next ?? '')}
      >
        <ComboboxTrigger
          id={id}
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-between font-normal"
            />
          }
        >
          <span
            className={cn(
              'min-w-0 truncate',
              value ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {value ? displayValue(value) : placeholder}
          </span>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder="Search…" showTrigger={false} />
          <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {itemLabel(item)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

function tierItemLabel(tier: string) {
  const definition = TIERS[tier as SubscriptionTier]
  if (!definition) return tier
  if (definition.maxLocations) {
    return `${definition.name} · ${definition.minLocations}–${definition.maxLocations} locations`
  }
  return `${definition.name} · ${definition.minLocations}+ locations`
}

function periodItemLabel(period: string) {
  if (period === 'annual') return 'Annual (2 months free, setup waived)'
  return 'Monthly'
}

function statusBadge(
  status: OrgSubscriptionStatus | string
): { label: string; variant: 'outline' | 'success' | 'warning' | 'destructive' | 'secondary' } {
  if (status === 'active') return { label: 'Active', variant: 'success' }
  if (status === 'past_due') return { label: 'Past due', variant: 'warning' }
  if (status === 'cancelled') return { label: 'Cancelled', variant: 'destructive' }
  if (status === 'pending') return { label: 'Pending payment', variant: 'secondary' }
  if (status === 'paid') return { label: 'Paid', variant: 'success' }
  if (status === 'open') return { label: 'Open', variant: 'warning' }
  if (status === 'void') return { label: 'Void', variant: 'secondary' }
  return { label: 'Audit', variant: 'outline' }
}

export function OrgBillingCard({
  orgId,
  locationCount,
}: {
  orgId: string
  locationCount: number
}) {
  const billing = useOrgBilling(orgId, { locationCount })
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const orgBadge = statusBadge(billing.orgStatus)
  const subBadge = billing.subscription
    ? statusBadge(billing.subscription.status)
    : null

  async function onSave() {
    setActionError(null)
    const result = await billing.saveSubscription()
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSuccess('Subscription saved')
    window.setTimeout(() => setSuccess(null), 3000)
  }

  async function onRaise() {
    setActionError(null)
    const result = await billing.raiseInvoice()
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSuccess(
      result.emailError
        ? `Invoice raised, but email failed: ${result.emailError} Use the payment link below.`
        : result.emailedTo
          ? `Invoice emailed to ${result.emailedTo}.`
          : result.hostedInvoiceUrl
            ? 'Invoice raised. Open the payment link from the table below.'
            : 'Invoice raised.'
    )
    window.setTimeout(() => setSuccess(null), 4000)
  }

  return (
    <SurfaceCard>
      <div className="border-b border-border-table px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Billing</p>
            <p className="text-xs text-muted-foreground">
              Invoices are raised here and sent as a Stripe payment link. Prices
              exclude VAT.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={orgBadge.variant}>{orgBadge.label}</Badge>
            {subBadge && billing.subscription ? (
              <Badge variant="secondary">
                {TIERS[billing.subscription.tier].name} · {subBadge.label}
              </Badge>
            ) : (
              <Badge variant="outline">No subscription</Badge>
            )}
          </div>
        </div>
      </div>

      {billing.error || actionError ? (
        <div className="px-4 pt-4">
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertTitle>Could not update billing</AlertTitle>
            <AlertDescription>{actionError || billing.error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {success ? (
        <div className="px-4 pt-4">
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {billing.bandWarning ? (
        <div className="px-4 pt-4">
          <Alert>
            <WarningCircle />
            <AlertTitle>Location band</AlertTitle>
            <AlertDescription>{billing.bandWarning}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <BillingCombobox
              id="billing-tier"
              label="Tier"
              items={TIER_ORDER}
              value={billing.tier}
              placeholder="Choose a tier"
              emptyLabel="No matching tiers"
              displayValue={(tier) => TIERS[tier as SubscriptionTier]?.name ?? tier}
              itemLabel={tierItemLabel}
              onChange={(value) =>
                billing.setTier((value as SubscriptionTier) || 'local')
              }
            />
            <BillingCombobox
              id="billing-period"
              label="Billing period"
              items={['monthly', 'annual']}
              value={billing.billingPeriod}
              placeholder="Choose a period"
              emptyLabel="No matching periods"
              displayValue={periodItemLabel}
              itemLabel={periodItemLabel}
              onChange={(value) =>
                billing.setBillingPeriod((value as BillingPeriod) || 'monthly')
              }
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={billing.cadence === 'intensive'}
              onCheckedChange={(checked) =>
                billing.setCadence(
                  checked ? ('intensive' as SubscriptionCadence) : 'weekly'
                )
              }
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Intensive cadence</span>
              <span className="block text-xs text-muted-foreground">
                Twice-weekly shops. Adds 60% on the invoice as a separate line.
                Not shown on public pricing.
              </span>
            </span>
          </label>

          <Field className="gap-2 max-w-xs">
            <FieldLabel htmlFor="invoice-adjustment">
              Invoice adjustment %
            </FieldLabel>
            <Input
              id="invoice-adjustment"
              inputMode="decimal"
              placeholder="0"
              value={billing.adjustmentPercent}
              onChange={(event) =>
                billing.setAdjustmentPercent(event.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              Manual sales adjustment only, capped at 10%. Logged. Never written
              as a discounted list price.
            </p>
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={billing.saving}
              disabled={billing.loading || (!billing.dirty && Boolean(billing.subscription))}
              onClick={() => void onSave()}
            >
              Save plan
            </Button>
            <Button
              type="button"
              size="sm"
              loading={billing.raising}
              disabled={billing.loading || !billing.subscription || billing.dirty}
              onClick={() => void onRaise()}
            >
              Raise invoice
            </Button>
          </div>
          {billing.dirty && billing.subscription ? (
            <p className="text-xs text-muted-foreground">
              Save the plan before raising an invoice.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border-table bg-surface px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {billing.isFirstInvoice ? 'First invoice' : 'Next invoice'}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatGbpPence(billing.preview.totalPence)}
          </p>
          <p className="text-xs text-muted-foreground">
            {billing.locationCount} active location
            {billing.locationCount === 1 ? '' : 's'}
            {billing.tier === 'brand'
              ? ` · billed quantity ${billing.locationQuantity}`
              : ''}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {billing.preview.lines.map((line) => (
              <li
                key={line.key}
                className="flex items-start justify-between gap-3"
              >
                <span className="text-muted-foreground">{line.description}</span>
                <span
                  className={cn(
                    'tabular-nums',
                    line.amountPence < 0 && 'text-muted-foreground'
                  )}
                >
                  {formatGbpPence(line.amountPence)}
                </span>
              </li>
            ))}
          </ul>
          {billing.preview.setupFeeWaived ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Setup fee waived on annual billing.
            </p>
          ) : null}
        </div>
      </div>

      {billing.invoices.length > 0 ? (
        <div className="border-t border-border-table">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.invoices.map((invoice) => {
                const badge = statusBadge(invoice.status)
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTimeShort(invoice.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatGbpPence(
                        invoice.status === 'paid'
                          ? invoice.amountPaidPence
                          : invoice.amountDuePence
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.hostedInvoiceUrl ? (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm hover:underline"
                        >
                          Payment link
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </SurfaceCard>
  )
}
