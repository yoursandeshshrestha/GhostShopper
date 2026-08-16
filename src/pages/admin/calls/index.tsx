import { Link } from 'react-router-dom'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import { usePlatformCalls } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { CALL_STATUS_LABELS, callStatusVariant } from '@/types/org'

export function AdminCallsPage() {
  const { loading, loadingMore, error, calls, totalCount, hasMore, loadMore } =
    usePlatformCalls()

  return (
    <AppPage title="Calls" count={totalCount || undefined} loading={loading}>
      {error ? (
        <PageEmptyState title="Could not load calls" description={error} />
      ) : calls.length === 0 ? (
        <PageEmptyState
          title="No calls"
          description="Mystery-shop calls from every organisation show up here."
        />
      ) : (
        <SurfaceCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Organisation</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/admin/organisations/${call.orgId}`}
                      className="hover:underline"
                    >
                      {call.orgName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {call.locationName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={callStatusVariant(call.status)}>
                        {CALL_STATUS_LABELS[call.status]}
                      </Badge>
                      {call.flaggedForReview ? (
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
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        </SurfaceCard>
      )}
    </AppPage>
  )
}
