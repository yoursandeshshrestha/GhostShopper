import { ArrowUpRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DashboardLocation } from '@/hooks/use-org-dashboard'
import { formatDateTimeShort } from '@/lib/datetime'
import { CALL_STATUS_LABELS } from '@/types/org'

function statusLabel(stats: DashboardLocation['stats']) {
  if (!stats.lastStatus) return 'Not called'
  if (stats.lastStatus === 'completed') return 'Reviewed'
  return CALL_STATUS_LABELS[stats.lastStatus]
}

function statusVariant(stats: DashboardLocation['stats']) {
  if (!stats.lastStatus) return 'secondary' as const
  if (stats.lastStatus === 'completed') return 'success' as const
  if (stats.lastStatus === 'analysing') return 'default' as const
  if (stats.lastStatus === 'awaiting_review') return 'secondary' as const
  if (
    stats.lastStatus === 'failed' ||
    stats.lastStatus === 'missed' ||
    stats.lastStatus === 'voicemail' ||
    stats.lastStatus === 'line_busy' ||
    stats.lastStatus === 'short_call'
  ) {
    return 'destructive' as const
  }
  return 'secondary' as const
}

function formatLastCall(value: string | null) {
  if (!value) return '—'
  return formatDateTimeShort(value)
}

export function LeagueTable({
  locations,
}: {
  locations: DashboardLocation[]
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Network league table</h2>
          <p className="text-xs text-muted-foreground">
            {locations.length === 0
              ? 'Locations you add in setup will appear here'
              : `${locations.length} location${locations.length === 1 ? '' : 's'} · scores attach to locations, never named staff`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/locations">
            View all
            <ArrowUpRight className="size-4" weight="regular" />
          </Link>
        </Button>
      </div>

      {locations.length === 0 ? (
        <p className="px-6 pb-10 text-sm text-muted-foreground">
          No locations yet. Finish setup or add locations to see your league
          table.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last call</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((row, index) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer focus-visible:outline-none"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      className="size-6 rounded-md after:rounded-md"
                    >
                      <AvatarFallback className="rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {row.name}
                      </p>
                      {row.timezone || row.country ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {[row.timezone, row.country]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.stats)}>
                    {statusLabel(row.stats)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatLastCall(row.stats.lastCallAt)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.stats.lastScore == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    row.stats.lastScore
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
