import { Link } from 'react-router-dom'
import { MapPin, PhoneOutgoing, WarningCircle } from '@phosphor-icons/react'
import { useOrgContext } from '@/hooks/use-org-context'
import { useNewCall } from '@/components/calls/NewCallProvider'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Button } from '@/components/ui/button'
import { useOrgDashboard } from '@/hooks/use-org-dashboard'
import { canManageOrg, showNewCallCta } from '@/lib/permissions'
import { DashboardExportMenu } from './components/DashboardExportMenu'
import { LeagueTable } from './components/LeagueTable'
import { MetricCards } from './components/MetricCards'
import { ScoreTrend } from './components/ScoreTrend'

const emptyData = {
  locations: [],
  locationCount: 0,
  criteriaCount: 0,
  totalCriteriaCount: 0,
  scorecardCount: 0,
  agentCount: 0,
  approvedAgentCount: 0,
  scenarioApproved: false,
  pendingInvites: 0,
  teamMembers: 0,
  networkAverage: null,
  weeklyTrend: [],
  monthlyTrend: [],
  yearlyTrend: [],
  awaitingReviewCount: 0,
  totalCalls: 0,
}

export function DashboardPage() {
  const { profile, organisation } = useOrgContext()
  const { loading, loadingMore, error, data, hasMore, loadMore, refresh } =
    useOrgDashboard()
  const dashboard = data ?? emptyData
  const role = profile?.role ?? null
  const canStartCall = showNewCallCta(role)
  const canManage = canManageOrg(role)
  const { openNewCall } = useNewCall()

  return (
    <AppPage
      title="Dashboard"
      count={
        dashboard.locationCount > 0
          ? `${dashboard.locationCount} location${dashboard.locationCount === 1 ? '' : 's'}`
          : undefined
      }
      loading={loading}
      actions={
        <>
          {dashboard.totalCalls > 0 || dashboard.locationCount > 0 ? (
            <DashboardExportMenu
              data={dashboard}
              orgName={organisation?.name ?? null}
            />
          ) : null}
          {dashboard.awaitingReviewCount > 0 ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/review">
                <WarningCircle />
                Review ({dashboard.awaitingReviewCount})
              </Link>
            </Button>
          ) : null}
          {canStartCall ? (
            <Button type="button" size="sm" onClick={openNewCall}>
              <PhoneOutgoing />
              New call
            </Button>
          ) : null}
        </>
      }
    >
      {error ? (
        <PageEmptyState
          title="Could not load dashboard"
          description={error}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          }
        />
      ) : dashboard.locationCount === 0 && dashboard.totalCalls === 0 ? (
        <PageEmptyState
          title="No locations yet"
          description="Add locations in setup, then start mystery-shop calls to see scores here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {canManage ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/locations">
                    <MapPin />
                    Add locations
                  </Link>
                </Button>
              ) : null}
              {canStartCall ? (
                <Button type="button" size="sm" onClick={openNewCall}>
                  <PhoneOutgoing />
                  New call
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
            <ScoreTrend
              networkAverage={dashboard.networkAverage}
              weeklyTrend={dashboard.weeklyTrend}
              monthlyTrend={dashboard.monthlyTrend}
              yearlyTrend={dashboard.yearlyTrend}
              totalCalls={dashboard.totalCalls}
            />
            <LeagueTable
              locations={dashboard.locations}
              locationCount={dashboard.locationCount}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          </div>
          <MetricCards data={dashboard} />
        </>
      )}
    </AppPage>
  )
}
