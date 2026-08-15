import {
  ClipboardText,
  MapPin,
  PhoneOutgoing,
  Robot,
  Trophy,
  UsersThree,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import type { OrgDashboardData } from '@/hooks/use-org-dashboard'

type InsightItem = {
  icon: Icon
  label: string
  value: string
  detail: string
}

interface InsightsStripProps {
  data: OrgDashboardData
}

export function InsightsStrip({ data }: InsightsStripProps) {
  const topLocation = [...data.locations]
    .filter((location) => location.stats.lastScore != null)
    .sort(
      (a, b) =>
        (b.stats.lastScore ?? 0) - (a.stats.lastScore ?? 0)
    )[0]

  const items: InsightItem[] = []

  if (data.networkAverage != null) {
    items.push({
      icon: Trophy,
      label: 'Network average',
      value: String(data.networkAverage),
      detail: `${data.totalCalls} call${data.totalCalls === 1 ? '' : 's'}`,
    })
  }

  if (topLocation) {
    items.push({
      icon: MapPin,
      label: 'Top location',
      value: topLocation.name,
      detail: `Score ${topLocation.stats.lastScore}`,
    })
  }

  if (data.awaitingReviewCount > 0) {
    items.push({
      icon: PhoneOutgoing,
      label: 'Awaiting review',
      value: String(data.awaitingReviewCount),
      detail: data.awaitingReviewCount === 1 ? 'call' : 'calls',
    })
  }

  items.push({
    icon: ClipboardText,
    label: 'Scorecards',
    value: String(data.scorecardCount),
    detail: `${data.totalCriteriaCount} criteria across ${data.scorecardCount || 0}`,
  })

  items.push({
    icon: Robot,
    label: 'Agents',
    value: String(data.agentCount),
    detail:
      data.approvedAgentCount > 0
        ? `${data.approvedAgentCount} approved`
        : 'None approved yet',
  })

  if (data.teamMembers > 0) {
    items.push({
      icon: UsersThree,
      label: 'Team',
      value: String(data.teamMembers),
      detail:
        data.pendingInvites > 0
          ? `${data.pendingInvites} invite${data.pendingInvites === 1 ? '' : 's'} pending`
          : 'active members',
    })
  }

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item.label}
          variant="secondary"
          className="h-auto gap-2 rounded-md px-3 py-2 font-normal"
        >
          <item.icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-medium text-foreground">{item.value}</span>
          <span className="text-muted-foreground">· {item.detail}</span>
        </Badge>
      ))}
    </div>
  )
}
