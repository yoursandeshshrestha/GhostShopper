import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TrendPeriod, TrendPoint } from '@/hooks/use-org-dashboard'
import { ChartCard } from './ChartCard'

const chartConfig = {
  score: {
    label: 'Network average',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

const PERIOD_COPY: Record<TrendPeriod, { title: string; description: string }> =
  {
    weekly: {
      title: 'Network average',
      description: 'Weekly mystery-shop scores across your locations',
    },
    monthly: {
      title: 'Network average',
      description: 'Monthly mystery-shop scores across your locations',
    },
    yearly: {
      title: 'Network average',
      description: 'Yearly mystery-shop scores across your locations',
    },
  }

export function ScoreTrend({
  networkAverage,
  weeklyTrend,
  monthlyTrend,
  yearlyTrend,
  totalCalls,
}: {
  networkAverage: number | null
  weeklyTrend: TrendPoint[]
  monthlyTrend: TrendPoint[]
  yearlyTrend: TrendPoint[]
  totalCalls: number
}) {
  const [period, setPeriod] = useState<TrendPeriod>('weekly')

  const trend = useMemo(() => {
    if (period === 'monthly') return monthlyTrend
    if (period === 'yearly') return yearlyTrend
    return weeklyTrend
  }, [monthlyTrend, period, weeklyTrend, yearlyTrend])

  const hasScores = trend.some((point) => point.score > 0)
  const copy = PERIOD_COPY[period]

  return (
    <ChartCard
      title={copy.title}
      description={copy.description}
      className="lg:col-span-2"
      headerExtra={
        <Tabs
          value={period}
          onValueChange={(value) => setPeriod(value as TrendPeriod)}
        >
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <p className="text-2xl font-medium tracking-tight tabular-nums">
          {networkAverage == null ? '—' : networkAverage}
        </p>
        <Badge variant="secondary">
          {totalCalls === 0
            ? 'No calls yet'
            : hasScores
              ? `${totalCalls} call${totalCalls === 1 ? '' : 's'}`
              : 'Awaiting reviews'}
        </Badge>
      </div>

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[280px] w-full"
      >
        <BarChart data={trend} accessibilityLayer barCategoryGap="18%">
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-border/50"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 100]}
            ticks={[0, 40, 70, 100]}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            width={36}
          />
          <ChartTooltip
            cursor={{ fill: 'transparent' }}
            content={<ChartTooltipContent />}
          />
          <Bar
            dataKey="score"
            fill="var(--color-score)"
            radius={999}
            background={{ fill: 'var(--border-table)', radius: 999 }}
            maxBarSize={28}
            cursor="pointer"
            activeBar={{ fill: 'var(--primary)' }}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
