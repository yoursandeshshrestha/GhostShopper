import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Plus, Prohibit, Trash, WarningCircle } from '@phosphor-icons/react'
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
import { ImpersonateUserButton } from '@/components/auth/ImpersonateUserButton'
import { usePlatformUsers } from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { formatRole, roleBadgeVariant } from '@/pages/settings/lib'

export function AdminUsersPage() {
  const {
    loading,
    loadingMore,
    saving,
    error,
    users,
    invites,
    totalCount,
    hasMore,
    loadMore,
    inviteSuperadmin,
    revokeSuperadminInvite,
    suspendUser,
    unsuspendUser,
  } = usePlatformUsers()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function closeInvite() {
    setInviteOpen(false)
    setEmail('')
    setInviteError(null)
  }

  async function onInvite() {
    setInviteError(null)
    const result = await inviteSuperadmin(email)
    if (result.error) {
      setInviteError(result.error)
      return
    }
    closeInvite()
  }

  async function copyLink(token: string, id: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${token}`
    )
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <AppPage
      title="Users"
      count={totalCount || undefined}
      loading={loading}
      actions={
        <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
          <Plus />
          Invite superadmin
        </Button>
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {invites.length > 0 ? (
        <SurfaceCard>
          <div className="border-b border-border-table px-4 py-3">
            <p className="text-sm font-medium">
              Pending superadmin invites ({invites.length})
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant('superadmin')}>
                      {formatRole('superadmin')}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTimeShort(invite.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyLink(invite.token, invite.id)}
                      >
                        <Copy />
                        {copiedId === invite.id ? 'Copied' : 'Copy link'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setActionError(null)
                          void revokeSuperadminInvite(invite.id).then(
                            (result) => {
                              if (result.error) setActionError(result.error)
                            }
                          )
                        }}
                      >
                        <Trash />
                        Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceCard>
      ) : null}

      {users.length === 0 ? (
        <PageEmptyState
          title="No users"
          description="People appear here when they join GhostShopper."
        />
      ) : (
        <SurfaceCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.fullName || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {formatRole(user.role)}
                      </Badge>
                      {user.suspendedAt ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.orgId ? (
                      <Link
                        to={`/admin/organisations/${user.orgId}`}
                        className="hover:underline"
                      >
                        {user.orgName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{user.orgName}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTimeShort(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {user.orgId && user.role !== 'superadmin' ? (
                        user.suspendedAt ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={saving}
                            onClick={() => {
                              setActionError(null)
                              void unsuspendUser(user.id).then((result) => {
                                if (result.error) setActionError(result.error)
                              })
                            }}
                          >
                            Unsuspend
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={saving}
                            onClick={() => {
                              setActionError(null)
                              void suspendUser(user.id).then((result) => {
                                if (result.error) setActionError(result.error)
                              })
                            }}
                          >
                            <Prohibit />
                            Suspend
                          </Button>
                        )
                      ) : null}
                      {user.orgId ? (
                        <ImpersonateUserButton userId={user.id} />
                      ) : user.role === 'superadmin' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
                    </div>
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
        open={inviteOpen}
        onOpenChange={(open) => {
          if (open) {
            setInviteOpen(true)
            return
          }
          closeInvite()
        }}
      >
        <DialogContent size="sm" className="gap-0">
          <DialogHeader>
            <DialogTitle>Invite superadmin</DialogTitle>
            <DialogDescription>
              They get a magic-link invite to manage GhostShopper, not a
              customer organisation.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 px-6 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              void onInvite()
            }}
          >
            <Field className="gap-2">
              <FieldLabel htmlFor="superadmin-email">Email</FieldLabel>
              <Input
                id="superadmin-email"
                type="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@ghostshopper.ai"
              />
            </Field>
            {inviteError ? (
              <p className="text-sm text-destructive">{inviteError}</p>
            ) : null}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeInvite}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={!email.trim()}
              onClick={() => void onInvite()}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  )
}
