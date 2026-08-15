import type { OrgDashboardData, TrendPoint } from '@/hooks/use-org-dashboard'
import { CALL_STATUS_LABELS } from '@/types/org'
import { formatDateTimeShort } from '@/lib/datetime'

export type DashboardReportFormat = 'csv' | 'pdf'

export interface DashboardReportModel {
  orgName: string
  generatedAt: string
  filenameSlug: string
  summary: Array<{ field: string; value: string; notes: string }>
  weeklyTrend: Array<{ period: string; score: string }>
  monthlyTrend: Array<{ period: string; score: string }>
  yearlyTrend: Array<{ period: string; score: string }>
  locations: Array<{
    name: string
    phone: string
    timezone: string
    country: string
    callFrequency: string
    status: string
    lastCall: string
    lastScore: string
  }>
}

function locationStatusLabel(
  status: OrgDashboardData['locations'][number]['stats']['lastStatus']
) {
  if (!status) return 'Not called'
  if (status === 'completed') return 'Reviewed'
  return CALL_STATUS_LABELS[status]
}

function topLocation(data: OrgDashboardData) {
  return [...data.locations]
    .filter((location) => location.stats.lastScore != null)
    .sort(
      (a, b) => (b.stats.lastScore ?? 0) - (a.stats.lastScore ?? 0)
    )[0]
}

function trendRows(points: TrendPoint[]) {
  const scored = points.filter((point) => point.score > 0)
  if (scored.length === 0) {
    return [{ period: '—', score: 'No scored calls in this period' }]
  }
  return scored.map((point) => ({
    period: point.label,
    score: String(point.score),
  }))
}

export function buildDashboardReport(
  data: OrgDashboardData,
  options?: { orgName?: string | null }
): DashboardReportModel {
  const generatedAt = new Date().toISOString()
  const orgName = options?.orgName?.trim() || '—'
  const top = topLocation(data)

  const summary: DashboardReportModel['summary'] = [
    { field: 'Organisation', value: orgName, notes: '' },
    { field: 'Generated at', value: formatDateTimeShort(generatedAt), notes: '' },
    {
      field: 'Locations',
      value: String(data.locations.length),
      notes: 'Configured in network',
    },
    {
      field: 'Total calls',
      value: String(data.totalCalls),
      notes: 'All calls in org',
    },
    {
      field: 'Network average',
      value: data.networkAverage == null ? '—' : String(data.networkAverage),
      notes: 'Across scored calls',
    },
    {
      field: 'Awaiting review',
      value: String(data.awaitingReviewCount),
      notes: data.awaitingReviewCount === 1 ? 'call' : 'calls',
    },
    {
      field: 'Scorecards',
      value: String(data.scorecardCount),
      notes: `${data.totalCriteriaCount} criteria total`,
    },
    {
      field: 'Default scorecard criteria',
      value: String(data.criteriaCount),
      notes: 'On active default scorecard',
    },
    {
      field: 'Agents',
      value: String(data.agentCount),
      notes:
        data.approvedAgentCount > 0
          ? `${data.approvedAgentCount} approved`
          : 'None approved yet',
    },
    {
      field: 'Team members',
      value: String(data.teamMembers),
      notes:
        data.pendingInvites > 0
          ? `${data.pendingInvites} invite${data.pendingInvites === 1 ? '' : 's'} pending`
          : 'Active in workspace',
    },
  ]

  if (top) {
    summary.push({
      field: 'Top location',
      value: top.name,
      notes: `Score ${top.stats.lastScore}`,
    })
  }

  const filenameSlug = (options?.orgName ?? 'dashboard')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return {
    orgName,
    generatedAt,
    filenameSlug,
    summary,
    weeklyTrend: trendRows(data.weeklyTrend),
    monthlyTrend: trendRows(data.monthlyTrend),
    yearlyTrend: trendRows(data.yearlyTrend),
    locations: data.locations.map((location) => ({
      name: location.name,
      phone: location.phone ?? '',
      timezone: location.timezone ?? '',
      country: location.country ?? '',
      callFrequency: location.callFrequency ?? '',
      status: locationStatusLabel(location.stats.lastStatus),
      lastCall: location.stats.lastCallAt
        ? formatDateTimeShort(location.stats.lastCallAt)
        : '',
      lastScore:
        location.stats.lastScore == null ? '' : String(location.stats.lastScore),
    })),
  }
}

export function dashboardReportFilename(
  report: DashboardReportModel,
  format: DashboardReportFormat
) {
  const date = report.generatedAt.slice(0, 10)
  const slug = report.filenameSlug || 'export'
  return `ghostshopper-dashboard-report-${slug}-${date}.${format}`
}
