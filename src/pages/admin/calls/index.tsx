import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { detailPanelPaddingClass } from '@/components/layout/DetailSlideOver'
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
import { Link } from 'react-router-dom'
import { useAdminCallDetailPanel } from '@/hooks/use-admin-call-detail-panel'
import { usePlatformCalls } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  CALL_STATUS_LABELS,
  callStatusVariant,
} from '@/types/org'

export function AdminCallsPage() {
  const { loading, loadingMore, error, calls, totalCount, hasMore, loadMore } =
    usePlatformCalls()
  const {
    selectedCallId,
    panelOpen,
    panelMounted,
    openCall,
    panel,
  } = useAdminCallDetailPanel()

  return (
    <>
      <AppPage
        title="Calls"
        count={totalCount || undefined}
        loading={loading}
        className={cn(
          'relative transition-[padding] duration-300 ease-in-out',
          detailPanelPaddingClass(panelOpen && panelMounted)
        )}
      >
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
                {calls.map((row) => {
                  const isSelected = selectedCallId === row.id
                  return (
                    <TableRow
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openCall(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openCall(row.id)
                        }
                      }}
                      className={cn(
                        'cursor-pointer transition-colors',
                        'focus-visible:outline-none',
                        isSelected && 'bg-surface-hover/40'
                      )}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to={`/admin/organisations/${row.orgId}`}
                          className="hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.orgName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.locationName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={callStatusVariant(row.status)}>
                            {CALL_STATUS_LABELS[row.status]}
                          </Badge>
                          {row.flaggedForReview ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Flagged
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.score == null ? '—' : row.score}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTimeShort(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
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

      {panel}
    </>
  )
}
