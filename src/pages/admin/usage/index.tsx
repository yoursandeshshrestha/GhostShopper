import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, GearSix, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatUsageUnits,
  USAGE_OPERATION_LABELS,
  usePlatformUsage,
  type UsageOperation,
} from '@/hooks/use-platform-usage'
import { usePlatformPricing } from '@/hooks/use-platform-pricing'
import { formatGbp } from '@/lib/currency'
import { formatDateTimeShort } from '@/lib/datetime'
import { MetricCard } from '@/pages/dashboard/components/MetricCard'

const OPERATIONS: UsageOperation[] = [
  'voice_call',
  'call_grade',
  'scenario_gen',
]

function summaryForOperation(
  summary: ReturnType<typeof usePlatformUsage>['summary'],
  operation: UsageOperation
) {
  return summary.find((row) => row.operation === operation)
}

function isUsageSetupError(message: string | null) {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('usage_events') ||
    lower.includes('platform_pricing') ||
    lower.includes('get_platform_usage') ||
    lower.includes('schema cache') ||
    lower.includes('does not exist')
  )
}

export function AdminUsagePage() {
  const {
    loading,
    loadingMore,
    error,
    summary,
    byOrg,
    events,
    totalCostUsd,
    totalEvents,
    hasMore,
    loadMore,
    backfill,
  } = usePlatformUsage()

  const {
    loading: pricingLoading,
    saving: pricingSaving,
    error: pricingError,
    pricing,
    voiceUsdPerMinute,
    setVoiceUsdPerMinute,
    dirty: pricingDirty,
    save: savePricing,
  } = usePlatformPricing()

  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingActionError, setPricingActionError] = useState<string | null>(
    null
  )
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null)

  const canSavePricing = useMemo(() => {
    const parsed = Number(voiceUsdPerMinute)
    return (
      pricingDirty &&
      Number.isFinite(parsed) &&
      parsed >= 0 &&
      voiceUsdPerMinute.trim() !== ''
    )
  }, [pricingDirty, voiceUsdPerMinute])

  async function onSavePricing() {
    setPricingActionError(null)
    const result = await savePricing()
    if (result.error) {
      setPricingActionError(result.error)
      return
    }
    setPricingSuccess('Voice pricing updated')
    window.setTimeout(() => setPricingSuccess(null), 3000)
    setPricingOpen(false)
  }

  function closePricingModal() {
    setPricingOpen(false)
    setPricingActionError(null)
    if (pricing) {
      setVoiceUsdPerMinute(String(pricing.voiceUsdPerMinute))
    }
  }

  async function onBackfill() {
    setBackfillMessage(null)
    setBackfilling(true)
    const result = await backfill()
    setBackfilling(false)
    if (result.error) return
    setBackfillMessage(
      `Backfilled ${result.voiceInserted.toLocaleString()} voice events and ${result.gradeInserted.toLocaleString()} grading events.`
    )
  }

  return (
    <AppPage
      title="Platform spend"
      loading={loading}
      actions={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPricingActionError(null)
              setPricingOpen(true)
            }}
          >
            <GearSix />
            Voice pricing
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={backfilling}
            onClick={() => void onBackfill()}
          >
            Backfill history
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {pricingSuccess ? (
          <Alert>
            <Check weight="bold" />
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{pricingSuccess}</AlertDescription>
          </Alert>
        ) : null}

        {backfillMessage ? (
          <Alert>
            <Check weight="bold" />
            <AlertTitle>Backfill complete</AlertTitle>
            <AlertDescription>{backfillMessage}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading usage…</p>
        ) : error ? (
          <PageEmptyState
            title={
              isUsageSetupError(error)
                ? 'Usage tracking is not set up on this project'
                : 'Could not load usage'
            }
            description={
              isUsageSetupError(error)
                ? 'Push the latest Supabase migrations and redeploy edge functions to your remote project: supabase db push, then supabase functions deploy start-call elevenlabs-webhook generate-scenario sync-call-status'
                : error
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total spend"
                value={formatGbp(totalCostUsd)}
                subtitle={`${totalEvents.toLocaleString()} metered events`}
              />
              {OPERATIONS.map((operation) => {
                const row = summaryForOperation(summary, operation)
                return (
                  <MetricCard
                    key={operation}
                    label={USAGE_OPERATION_LABELS[operation]}
                    value={formatGbp(row?.totalCostUsd ?? 0)}
                    subtitle={`${(row?.eventCount ?? 0).toLocaleString()} events`}
                  />
                )
              })}
            </div>

          {byOrg.length > 0 ? (
            <SurfaceCard>
              <div className="border-b border-border-table px-4 py-3">
                <p className="text-sm font-medium">Spend by organisation</p>
                <p className="text-xs text-muted-foreground">
                  Attributed platform cost per customer org.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead className="text-right">Voice</TableHead>
                    <TableHead className="text-right">Grading</TableHead>
                    <TableHead className="text-right">Scenarios</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byOrg.map((row) => (
                    <TableRow key={row.orgId}>
                      <TableCell>
                        <Link
                          to={`/admin/organisations/${row.orgId}`}
                          className="font-medium hover:underline"
                        >
                          {row.orgName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGbp(row.voiceCallCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGbp(row.callGradeCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGbp(row.scenarioGenCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatGbp(row.totalCostUsd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.eventCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SurfaceCard>
          ) : null}

          <SurfaceCard>
            <div className="border-b border-border-table px-4 py-3">
              <p className="text-sm font-medium">Recent usage events</p>
              <p className="text-xs text-muted-foreground">
                Each voice call, graded call, and scenario generation.
              </p>
            </div>
            {events.length === 0 ? (
              <div className="px-4 py-8">
                <PageEmptyState
                  title="No usage recorded yet"
                  description="Usage is tracked automatically for new calls. To import past calls, click Backfill history above."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={backfilling}
                      onClick={() => void onBackfill()}
                    >
                      Backfill history
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTimeShort(event.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/admin/organisations/${event.orgId}`}
                            className="hover:underline"
                          >
                            {event.orgName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {USAGE_OPERATION_LABELS[event.operation]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {formatUsageUnits(event.operation, event.units)}
                          {event.metadata.backfilled ? ' · backfilled' : ''}
                          {event.metadata.simulated ? ' · simulated' : ''}
                          {event.resourceId &&
                          (event.operation === 'voice_call' ||
                            event.operation === 'call_grade') ? (
                            <>
                              {' · '}
                              <Link
                                to="/admin/calls"
                                className="hover:underline"
                              >
                                call
                              </Link>
                            </>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatGbp(event.costUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-border-table px-4 py-3">
                  <LoadMoreButton
                    hasMore={hasMore}
                    loading={loadingMore}
                    onLoadMore={() => loadMore()}
                  />
                </div>
              </>
            )}
          </SurfaceCard>
          </>
        )}
      </div>

      <Dialog
        open={pricingOpen}
        onOpenChange={(open) => {
          if (open) {
            setPricingActionError(null)
            setPricingOpen(true)
            return
          }
          closePricingModal()
        }}
      >
        <DialogContent size="sm" className="gap-0">
          <DialogHeader>
            <DialogTitle>Voice pricing</DialogTitle>
            <DialogDescription>
              Used to estimate ElevenLabs voice call cost on this page. LLM costs
              come from OpenRouter automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 px-6 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              void onSavePricing()
            }}
          >
            {pricingError || pricingActionError ? (
              <Alert variant="destructive">
                <WarningCircle weight="fill" />
                <AlertTitle>Could not update pricing</AlertTitle>
                <AlertDescription>
                  {pricingActionError || pricingError}
                </AlertDescription>
              </Alert>
            ) : null}

            {pricingLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Field className="gap-2">
                <FieldLabel htmlFor="voice-usd-per-minute">
                  Rate per minute
                </FieldLabel>
                <FieldDescription>
                  Applied to each completed voice call when usage is recorded.
                </FieldDescription>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    id="voice-usd-per-minute"
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    value={voiceUsdPerMinute}
                    onChange={(event) =>
                      setVoiceUsdPerMinute(event.target.value)
                    }
                    className="tabular-nums"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    / min
                  </span>
                </div>
                {pricing?.updatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last updated {formatDateTimeShort(pricing.updatedAt)}.
                  </p>
                ) : null}
              </Field>
            )}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePricingModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={pricingSaving}
              disabled={!canSavePricing || pricingLoading}
              onClick={() => void onSavePricing()}
            >
              Save pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  )
}
