import { LeagueTable } from './components/LeagueTable'
import { MetricCards } from './components/MetricCards'
import { ScoreTrend } from './components/ScoreTrend'

export function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-2">
      <div className="mb-2">
        <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground">
          GhostShopper
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 max-w-xl text-sm font-normal leading-relaxed text-muted-foreground">
          Weekly mystery-shop scores across your locations. Missed and failed
          calls count as zero.
        </p>
      </div>

      <ScoreTrend />
      <MetricCards />
      <LeagueTable />
    </div>
  )
}
