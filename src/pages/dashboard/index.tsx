import { Link } from 'react-router-dom'
import { MapPin, PhoneOutgoing, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Button } from '@/components/ui/button'
import { useOrgDashboard } from '@/hooks/use-org-dashboard'
import { canManageOrg, showNewCallCta } from '@/lib/permissions'
import { DashboardExportMenu } from './components/DashboardExportMenu'
import { InsightsStrip } from './components/InsightsStrip'
import { LeagueTable } from './components/LeagueTable'
import { MetricCards } from './components/MetricCards'
import { ScoreTrend } from './components/ScoreTrend'

const emptyData = {
  locations: [],
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
  const { profile, organisation } = useAuth()
  const { loading, error, data, refresh } = useOrgDashboard()
  const dashboard = data ?? emptyData
  const role = profile?.role ?? null
  const canStartCall = showNewCallCta(role)
  const canManage = canManageOrg(role)

  return (
    <AppPage
      title="Dashboard"
      count={
        dashboard.locations.length > 0
          ? `${dashboard.locations.length} location${dashboard.locations.length === 1 ? '' : 's'}`
          : undefined
      }
      loading={loading}
      actions={
        <>
          {dashboard.totalCalls > 0 || dashboard.locations.length > 0 ? (
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
            <Button type="button" size="sm" asChild>
              <Link to="/new-call">
                <PhoneOutgoing />
                New call
              </Link>
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
      ) : dashboard.locations.length === 0 && dashboard.totalCalls === 0 ? (
        <>
          <InsightsStrip data={dashboard} />
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
                  <Button type="button" size="sm" asChild>
                    <Link to="/new-call">
                      <PhoneOutgoing />
                      New call
                    </Link>
                  </Button>
                ) : null}
              </div>
            }
          />
        </>
      ) : (
        <>
          <InsightsStrip data={dashboard} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ScoreTrend
              networkAverage={dashboard.networkAverage}
              weeklyTrend={dashboard.weeklyTrend}
              monthlyTrend={dashboard.monthlyTrend}
              yearlyTrend={dashboard.yearlyTrend}
              totalCalls={dashboard.totalCalls}
            />
          </div>
          <MetricCards data={dashboard} />
          <LeagueTable locations={dashboard.locations} />
        </>
      )}
    </AppPage>
  )
}
