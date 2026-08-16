import { Link, useParams } from 'react-router-dom'
import { AppPage, SurfaceCard, SurfacePanel } from '@/components/layout/AppPage'
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
import { usePlatformOrgDetail } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { formatRole, roleBadgeVariant } from '@/pages/settings/lib'
import { CALL_STATUS_LABELS, callStatusVariant } from '@/types/org'

export function AdminOrganisationDetailPage() {
  const { id } = useParams()
  const {
    loading,
    loadingMore,
    error,
    org,
    members,
    calls,
    totalCallCount,
    hasMore,
    loadMore,
  } = usePlatformOrgDetail(id)

  return (
    <AppPage
      title={org?.name ?? 'Organisation'}
      loading={loading}
      backHref="/admin/organisations"
      backLabel="Organisations"
    >
      {error ? (
        <PageEmptyState title="Could not load organisation" description={error} />
      ) : !org ? (
        <PageEmptyState
          title="Organisation not found"
          description="This account may have been removed."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SurfacePanel>
              <p className="text-xs text-muted-foreground">Industry</p>
              <p className="mt-1 text-sm font-medium">{org.industry || '—'}</p>
            </SurfacePanel>
            <SurfacePanel>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                {org.setupCompleted ? (
                  <Badge variant="success">Live</Badge>
                ) : org.attested ? (
                  <Badge variant="warning">Setup</Badge>
                ) : (
                  <Badge variant="outline">Onboarding</Badge>
                )}
              </div>
            </SurfacePanel>
            <SurfacePanel>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {formatDateTimeShort(org.createdAt)}
              </p>
            </SurfacePanel>
          </div>

          <SurfaceCard>
            <div className="border-b border-border-table px-4 py-3">
              <p className="text-sm font-medium">Users ({members.length})</p>
            </div>
            {members.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No users in this organisation.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.fullName || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {formatRole(member.role)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center justify-between border-b border-border-table px-4 py-3">
              <p className="text-sm font-medium">
                Recent calls ({totalCallCount})
              </p>
              <Link
                to="/admin/calls"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                All calls
              </Link>
            </div>
            {calls.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No mystery-shop calls yet.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
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
                          {call.locationName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={callStatusVariant(call.status)}>
                            {CALL_STATUS_LABELS[call.status]}
                          </Badge>
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
              </>
            )}
          </SurfaceCard>
        </div>
      )}
    </AppPage>
  )
}
