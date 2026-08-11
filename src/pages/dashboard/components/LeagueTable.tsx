import { ArrowUpRight } from '@phosphor-icons/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** Canonical demo league scores from the GhostShopper PRD */
const league = [
  {
    name: 'Richmond',
    score: 94,
    status: 'Passing' as const,
    called: '9 Aug 2026',
  },
  {
    name: 'Clapham',
    score: 91,
    status: 'Passing' as const,
    called: '9 Aug 2026',
  },
  {
    name: 'Battersea',
    score: 87,
    status: 'Passing' as const,
    called: '8 Aug 2026',
  },
  {
    name: 'Ealing',
    score: 52,
    status: 'At risk' as const,
    called: '8 Aug 2026',
  },
  {
    name: 'Croydon',
    score: 38,
    status: 'Failing' as const,
    called: '7 Aug 2026',
  },
  {
    name: 'Sutton',
    score: 0,
    status: 'Missed' as const,
    called: '—',
  },
]

const statusVariant = {
  Passing: 'success',
  'At risk': 'secondary',
  Failing: 'destructive',
  Missed: 'destructive',
} as const

export function LeagueTable() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <CardTitle>Network league table</CardTitle>
          <CardDescription>
            Week 32 · scores attach to locations, never named staff
          </CardDescription>
        </div>
        <Button variant="outline" size="sm">
          View all
          <ArrowUpRight className="size-4" weight="regular" />
        </Button>
      </CardHeader>

      <CardContent className="overflow-hidden rounded-b-xl border-t border-border px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-11 pl-4 text-muted-foreground">
                Location
              </TableHead>
              <TableHead className="h-11 text-muted-foreground">Status</TableHead>
              <TableHead className="h-11 text-muted-foreground">
                Last call
              </TableHead>
              <TableHead className="h-11 pr-4 text-right text-muted-foreground">
                Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {league.map((row, index) => (
              <TableRow
                key={row.name}
                tabIndex={0}
                className="cursor-pointer border-border transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      className="size-6 rounded-md after:rounded-md"
                    >
                      <AvatarFallback className="rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {row.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[row.status]}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.called}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      row.score < 50 ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {row.score}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
