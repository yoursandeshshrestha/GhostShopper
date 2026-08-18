import { Link } from 'react-router-dom'
import { Brain, Buildings, PhoneCall, SpeakerHigh, UsersThree, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlatformOverview } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { MetricCard } from '@/pages/dashboard/components/MetricCard'

export function AdminOverviewPage() {
  const { loading, error, orgs, overview } = usePlatformOverview()

  return (
    <AppPage title="Platform" loading={loading}>
      {error ? (
        <PageEmptyState title="Could not load platform" description={error} />
      ) : (
        <div className="space-y-4">
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
                AI models
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link to="/admin/calls">
                <PhoneCall />
                Calls
              </Link>
            </Button>
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
                          {org.memberCount} users · {org.locationCount} locations ·{' '}
                          {org.callCount} calls
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
