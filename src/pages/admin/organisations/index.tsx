import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import {
  IndustryField,
  isIndustryComplete,
} from '@/components/form/IndustryField'
import { usePlatformOrgs } from '@/hooks/use-platform'
import { usePlatformUsage } from '@/hooks/use-platform-usage'
import { formatGbp } from '@/lib/currency'
import { formatDateTimeShort } from '@/lib/datetime'

function orgStatusBadge(org: {
  suspendedAt: string | null
  setupCompleted: boolean
  attested: boolean
  subscriptionStatus: 'audit' | 'active' | 'past_due' | 'cancelled'
}) {
  if (org.suspendedAt) {
    return <Badge variant="destructive">Suspended</Badge>
  }
  if (org.subscriptionStatus === 'past_due') {
    return <Badge variant="warning">Past due</Badge>
  }
  if (org.subscriptionStatus === 'active') {
    return <Badge variant="success">Live</Badge>
  }
  if (org.subscriptionStatus === 'cancelled') {
    return <Badge variant="secondary">Cancelled</Badge>
  }
  if (org.setupCompleted) {
    return <Badge variant="outline">Audit</Badge>
  }
  if (org.attested) {
    return <Badge variant="warning">Setup</Badge>
  }
  return <Badge variant="outline">Onboarding</Badge>
}

export function AdminOrganisationsPage() {
  const navigate = useNavigate()
  const {
    loading,
    loadingMore,
    saving,
    error,
    orgs,
    totalCount,
    hasMore,
    loadMore,
    createOrg,
  } = usePlatformOrgs()
  const { byOrg } = usePlatformUsage()
  const spendByOrgId = useMemo(
    () => new Map(byOrg.map((row) => [row.orgId, row.totalCostUsd])),
    [byOrg]
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  function closeCreate() {
    setCreateOpen(false)
    setName('')
    setIndustry('')
    setOwnerEmail('')
    setCreateError(null)
  }

  async function onCreate() {
    setCreateError(null)
    const result = await createOrg({
      name,
      industry: industry && isIndustryComplete(industry) ? industry : undefined,
      ownerEmail,
    })
    if (result.error) {
      setCreateError(result.error)
      return
    }
    closeCreate()
    if (result.orgId) {
      navigate(`/admin/organisations/${result.orgId}`)
    }
  }

  return (
    <AppPage
      title="Organisations"
      count={totalCount || undefined}
      loading={loading}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          Create organisation
        </Button>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {orgs.length === 0 ? (
        <PageEmptyState
          title="No organisations"
          description="Create a customer organisation and invite their admin to get started."
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
                <TableHead className="text-right">Spend</TableHead>
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
                  <TableCell>{orgStatusBadge(org)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.memberCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.locationCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {org.callCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatGbp(spendByOrgId.get(org.id) ?? 0)}
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (open) {
            setCreateOpen(true)
            return
          }
          closeCreate()
        }}
      >
        <DialogContent size="sm" className="gap-0">
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
            <DialogDescription>
              Add a new customer organisation and send the owner an invite
              automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 px-6 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              void onCreate()
            }}
          >
            <Field className="gap-2">
              <FieldLabel htmlFor="org-name">Organisation name</FieldLabel>
              <Input
                id="org-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Retail Group"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="org-industry">Industry (optional)</FieldLabel>
              <IndustryField
                id="org-industry"
                value={industry}
                onChange={setIndustry}
                triggerClassName="border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-0"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="org-owner-email">Owner email</FieldLabel>
              <Input
                id="org-owner-email"
                type="email"
                required
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@company.com"
              />
            </Field>
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={
                !name.trim() ||
                !ownerEmail.trim() ||
                Boolean(industry && !isIndustryComplete(industry))
              }
              onClick={() => void onCreate()}
            >
              Create & send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  )
}
