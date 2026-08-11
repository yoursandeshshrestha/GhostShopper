import { Clock, Phone, WarningCircle } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const metrics = [
  {
    label: 'Calls this week',
    value: '24',
    change: '+16.7%',
    tone: 'success' as const,
    icon: Phone,
  },
  {
    label: 'Minutes listened',
    value: '86',
    change: '−2.1%',
    tone: 'destructive' as const,
    icon: Clock,
  },
  {
    label: 'Awaiting review',
    value: '3',
    change: '0.00%',
    tone: 'secondary' as const,
    icon: WarningCircle,
  },
]

export function MetricCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          size="sm"
          className="cursor-pointer gap-0 py-0 transition-colors hover:bg-accent/60"
        >
          <CardContent className="flex h-[132px] flex-col justify-between p-4">
            <metric.icon className="size-5 text-foreground" weight="regular" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-medium leading-[34px] text-foreground tabular-nums">
                  {metric.value}
                </p>
                <Badge variant={metric.tone}>{metric.change}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
