import type { OrgDashboardData } from '@/hooks/use-org-dashboard'
import { MetricCard } from './MetricCard'

export function MetricCards({ data }: { data: OrgDashboardData }) {
  const metrics = [
    {
      label: 'Locations',
      value: data.locationCount,
      subtitle:
        data.locationCount === 0
          ? 'None configured yet'
          : `${data.locationCount} configured`,
    },
    {
      label: 'Total calls',
      value: data.totalCalls,
      subtitle:
        data.awaitingReviewCount > 0
          ? `${data.awaitingReviewCount} awaiting review`
          : data.totalCalls === 0
            ? 'Start your first call'
            : 'Tracked in this org',
    },
    {
      label: 'Network average',
      value: data.networkAverage == null ? '—' : data.networkAverage,
      subtitle:
        data.networkAverage == null
          ? 'Scores appear after review'
          : 'Across reviewed calls',
    },
    {
      label: 'Scorecards',
      value: data.scorecardCount,
      subtitle:
        data.scorecardCount === 0
          ? 'None configured yet'
          : `${data.totalCriteriaCount} criteria total`,
    },
    {
      label: 'Agents',
      value: data.agentCount,
      subtitle:
        data.approvedAgentCount > 0
          ? `${data.approvedAgentCount} approved`
          : 'Approve an agent to call',
    },
    {
      label: 'Team members',
      value: data.teamMembers,
      subtitle:
        data.pendingInvites > 0
          ? `${data.pendingInvites} invite${data.pendingInvites === 1 ? '' : 's'} pending`
          : 'Active in workspace',
    },
    {
      label: 'Awaiting review',
      value: data.awaitingReviewCount,
      subtitle:
        data.awaitingReviewCount === 0
          ? 'All caught up'
          : 'Calls need scoring',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          subtitle={metric.subtitle}
        />
      ))}
    </div>
  )
}
