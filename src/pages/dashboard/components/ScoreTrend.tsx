import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const scoreTrend = [
  { week: 'W01', score: 48 },
  { week: 'W02', score: 62 },
  { week: 'W03', score: 71 },
  { week: 'W04', score: 58 },
  { week: 'W05', score: 44 },
  { week: 'W06', score: 39 },
  { week: 'W07', score: 46 },
  { week: 'W08', score: 52 },
  { week: 'W09', score: 61 },
  { week: 'W10', score: 50 },
  { week: 'W11', score: 88 },
  { week: 'W12', score: 68 },
]

const chartConfig = {
  score: {
    label: 'Network average',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function ScoreTrend() {
  const [period, setPeriod] = useState('weekly')

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-0">
        <div className="flex flex-col gap-0.5">
          <CardDescription>Network average</CardDescription>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl leading-[34px] tabular-nums">
              60
            </CardTitle>
            <Badge variant="destructive">−3 vs last week</Badge>
          </div>
        </div>

        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="px-4 pt-6 pb-3">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[221px] w-full"
        >
          <BarChart data={scoreTrend} accessibilityLayer barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="transparent" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 13 }}
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
              background={{ fill: 'var(--border)', radius: 999 }}
              maxBarSize={28}
              cursor="pointer"
              activeBar={{ fill: 'var(--primary)' }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
