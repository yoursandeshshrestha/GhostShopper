import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTimeShort } from '@/lib/datetime'
import { CALL_STATUS_LABELS, callStatusVariant, type OrgCall } from '@/types/org'
import { cn } from '@/lib/utils'

interface CallsTableProps {
  calls: OrgCall[]
  selectedId: string | null
  onSelect: (call: OrgCall) => void
}

export function CallsTable({ calls, selectedId, onSelect }: CallsTableProps) {
  return (
    <div className="surface-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => {
            const isSelected = selectedId === call.id
            const isAwaiting = call.status === 'awaiting_review'
            const isAnalysing = call.status === 'analysing'

            return (
              <TableRow
                key={call.id}
                tabIndex={0}
                onClick={() => onSelect(call)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(call)
                  }
                }}
                className={cn(
                  'cursor-pointer transition-colors',
                  'focus-visible:outline-none',
                  isSelected && 'bg-surface-hover/40',
                  isAwaiting && !isSelected && 'bg-surface-hover/20',
                  isAnalysing && !isSelected && 'bg-surface-hover/10'
                )}
              >
                <TableCell className="font-medium">{call.locationName}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={callStatusVariant(call.status)}>
                      {CALL_STATUS_LABELS[call.status]}
                    </Badge>
                    {call.flaggedForReview && call.status === 'awaiting_review' ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Flagged
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {call.score == null ? '—' : call.score}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDateTimeShort(call.createdAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
