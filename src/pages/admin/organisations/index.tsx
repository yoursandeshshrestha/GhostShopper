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
import { usePlatformOrgs } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'

export function AdminOrganisationsPage() {
  const { loading, loadingMore, error, orgs, totalCount, hasMore, loadMore } =
    usePlatformOrgs()

  return (
    <AppPage
      title="Organisations"
      count={totalCount || undefined}
      loading={loading}
    >
      {error ? (
        <PageEmptyState title="Could not load organisations" description={error} />
      ) : orgs.length === 0 ? (
        <PageEmptyState
          title="No organisations"
          description="Customer orgs appear here after they finish creating an account."
        />
      ) : (
        <SurfaceCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Organisation</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/admin/organisations/${org.id}`}
                      className="hover:underline"
                    >
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {org.industry || '—'}
                  </TableCell>
                  <TableCell>
                    {org.setupCompleted ? (
                      <Badge variant="success">Live</Badge>
                    ) : org.attested ? (
                      <Badge variant="warning">Setup</Badge>
                    ) : (
                      <Badge variant="outline">Onboarding</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.memberCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.locationCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.callCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTimeShort(org.createdAt)}
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
