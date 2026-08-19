import { Link } from 'react-router-dom'
import {
  Brain,
  Buildings,
  CurrencyDollar,
  PhoneCall,
  SpeakerHigh,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlatformOverview } from '@/hooks/use-platform'
import {
  formatUsageUnits,
  USAGE_OPERATION_LABELS,
  usePlatformUsage,
} from '@/hooks/use-platform-usage'
import { formatUsd } from '@/lib/currency'
import { formatDateTimeShort } from '@/lib/datetime'
import { MetricCard } from '@/pages/dashboard/components/MetricCard'

export function AdminOverviewPage() {
  const { loading, error, orgs, overview } = usePlatformOverview()
  const {
    loading: usageLoading,
    error: usageError,
    summary,
    byOrg,
    events,
    totalCostUsd,
    totalEvents,
  } = usePlatformUsage()

  const topOrgs = byOrg.slice(0, 5)
  const recentEvents = events.slice(0, 5)

  const voiceSpend =
    summary.find((row) => row.operation === 'voice_call')?.totalCostUsd ?? 0
  const gradingSpend =
    summary.find((row) => row.operation === 'call_grade')?.totalCostUsd ?? 0
  const scenarioSpend =
    summary.find((row) => row.operation === 'scenario_gen')?.totalCostUsd ?? 0

  return (
    <AppPage title="Platform" loading={loading || usageLoading}>
      {error ? (
        <PageEmptyState title="Could not load platform" description={error} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total spend"
              value={formatUsd(totalCostUsd)}
              subtitle={`${totalEvents.toLocaleString()} metered events`}
            />
            <MetricCard
              label="Voice"
              value={formatUsd(voiceSpend)}
              subtitle="ElevenLabs call minutes"
            />
            <MetricCard
              label="Grading"
              value={formatUsd(gradingSpend)}
              subtitle="OpenRouter call scoring"
            />
            <MetricCard
              label="Scenarios"
              value={formatUsd(scenarioSpend)}
              subtitle="OpenRouter scenario generation"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Organisations"
              value={overview.orgCount}
              subtitle="Customer accounts on GhostShopper"
            />
            <MetricCard
              label="Users"
              value={overview.userCount}
              subtitle="Owners, admins, coaches, and viewers"
            />
            <MetricCard
              label="Locations"
              value={overview.locationCount}
              subtitle="Shopped sites across every org"
            />
            <MetricCard
              label="Calls"
              value={overview.callCount}
              subtitle={`${overview.awaitingReviewCount} awaiting review`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/organisations">
                <Buildings />
                Organisations
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/users">
                <UsersThree />
                Users
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/voices">
                <SpeakerHigh />
                Voices
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/ai">
                <Brain />
                AI
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/usage">
                <CurrencyDollar />
                Spend
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/calls">
                <PhoneCall />
                Calls
              </Link>
            </Button>
          </div>

          {usageError ? (
            <p className="text-sm text-muted-foreground">{usageError}</p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <SurfaceCard>
              <div className="flex items-center justify-between gap-3 border-b border-border-table px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Top organisations</p>
                  <p className="text-xs text-muted-foreground">
                    Highest attributed platform spend
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link to="/admin/usage">View all</Link>
                </Button>
              </div>
              {topOrgs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No spend recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-border-table">
                  {topOrgs.map((org, index) => (
                    <li key={org.orgId}>
                      <Link
                        to={`/admin/organisations/${org.orgId}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-hover/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            <span className="mr-2 text-muted-foreground tabular-nums">
                              {index + 1}.
                            </span>
                            {org.orgName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {org.eventCount.toLocaleString()} events · Voice{' '}
                            {formatUsd(org.voiceCallCost)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatUsd(org.totalCostUsd)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>

            <SurfaceCard>
              <div className="flex items-center justify-between gap-3 border-b border-border-table px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Recent usage</p>
                  <p className="text-xs text-muted-foreground">
                    Last 5 metered events
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link to="/admin/usage">View all</Link>
                </Button>
              </div>
              {recentEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Events appear after voice calls, grading, or scenario
                  generation.
                </p>
              ) : (
                <ul className="divide-y divide-border-table">
                  {recentEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {USAGE_OPERATION_LABELS[event.operation]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {event.orgName} ·{' '}
                          {formatUsageUnits(event.operation, event.units)} ·{' '}
                          {formatDateTimeShort(event.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums font-medium">
                        {formatUsd(event.costUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
          </div>

          {orgs.length === 0 ? (
            <PageEmptyState
              title="No organisations yet"
              description="When a customer creates an organisation, it will show up here."
            />
          ) : (
            <SurfaceCard>
              <div className="border-b border-border-table px-4 py-3">
                <p className="text-sm font-medium">Recent organisations</p>
              </div>
              <ul className="divide-y divide-border-table">
                {orgs.map((org) => (
                  <li key={org.id}>
                    <Link
                      to={`/admin/organisations/${org.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-hover/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {org.memberCount} users · {org.locationCount}{' '}
                          locations · {org.callCount} calls
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {org.suspendedAt ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : org.setupCompleted ? (
                          <Badge variant="success">Live</Badge>
                        ) : org.attested ? (
                          <Badge variant="warning">Setup</Badge>
                        ) : (
                          <Badge variant="outline">Onboarding</Badge>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTimeShort(org.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}

          {overview.flaggedCount > 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <WarningCircle className="size-4" />
              {overview.flaggedCount} flagged call
              {overview.flaggedCount === 1 ? '' : 's'} across the platform.
            </p>
          ) : null}
        </div>
      )}
    </AppPage>
  )
}
