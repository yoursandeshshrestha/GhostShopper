import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Copy,
  Plus,
  Prohibit,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { AppPage, SurfaceCard, SurfacePanel } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { detailPanelPaddingClass } from '@/components/layout/DetailSlideOver'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { usePlatformOrgDetail } from '@/hooks/use-platform'
import { useAdminCallDetailPanel } from '@/hooks/use-admin-call-detail-panel'
import {
  formatUsageUnits,
  USAGE_OPERATION_LABELS,
  usePlatformUsage,
  type UsageOperation,
} from '@/hooks/use-platform-usage'
import { formatUsd } from '@/lib/currency'
import { formatDateTimeShort } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { formatRole, roleBadgeVariant } from '@/pages/settings/lib'
import { CALL_STATUS_LABELS, callStatusVariant } from '@/types/org'

export function AdminOrganisationDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const {
    loading,
    loadingMore,
    saving,
    error,
    org,
    members,
    invites,
    calls,
    totalCallCount,
    hasMore,
    loadMore,
    inviteOrgAdmin,
    revokeOrgInvite,
    suspendOrg,
    unsuspendOrg,
    deleteOrg,
    suspendMember,
    unsuspendMember,
  } = usePlatformOrgDetail(id)
  const {
    loading: usageLoading,
    loadingMore: usageLoadingMore,
    summary: usageSummary,
    events: usageEvents,
    totalCostUsd,
    totalEvents,
    hasMore: usageHasMore,
    loadMore: loadMoreUsage,
  } = usePlatformUsage(id)

  const {
    selectedCallId,
    panelOpen,
    panelMounted,
    openCall,
    panel: callDetailPanel,
  } = useAdminCallDetailPanel()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function closeInvite() {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteError(null)
  }

  async function onInvite() {
    setInviteError(null)
    const result = await inviteOrgAdmin(inviteEmail)
    if (result.error) {
      setInviteError(result.error)
      return
    }
    closeInvite()
  }

  async function copyLink(token: string, inviteId: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${token}`
    )
    setCopiedId(inviteId)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  async function onDeleteOrg() {
    setActionError(null)
    const result = await deleteOrg()
    if (result.error) {
      setActionError(result.error)
      return
    }
    navigate('/admin/organisations', { replace: true })
  }

  const isSuspended = Boolean(org?.suspendedAt)

  return (
    <>
    <AppPage
      title={org?.name ?? 'Organisation'}
      loading={loading}
      backHref="/admin/organisations"
      backLabel="Organisations"
      className={cn(
        'relative transition-[padding] duration-300 ease-in-out',
        detailPanelPaddingClass(panelOpen && panelMounted)
      )}
      actions={
        org ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setInviteOpen(true)}
              disabled={isSuspended}
            >
              <Plus />
              Invite admin
            </Button>
            {isSuspended ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={saving}
                onClick={() => {
                  setActionError(null)
                  void unsuspendOrg().then((result) => {
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
                  void suspendOrg().then((result) => {
                    if (result.error) setActionError(result.error)
                  })
                }}
              >
                <Prohibit />
                Suspend
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash />
              Delete
            </Button>
          </div>
        ) : null
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!org ? (
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
              <div className="mt-1 flex flex-wrap gap-2">
                {isSuspended ? (
                  <Badge variant="destructive">Suspended</Badge>
                ) : org.setupCompleted ? (
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
              <p className="text-sm font-medium">Platform spend</p>
              <p className="text-xs text-muted-foreground">
                Attributed cost to run this org on GhostShopper.
              </p>
            </div>
            {usageLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Loading spend…
              </p>
            ) : totalEvents === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No metered usage yet for this organisation.
              </p>
            ) : (
              <div className="grid gap-px bg-border-table sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-surface px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatUsd(totalCostUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalEvents.toLocaleString()} events
                  </p>
                </div>
                {(['voice_call', 'call_grade', 'scenario_gen'] as UsageOperation[]).map(
                  (operation) => {
                    const row = usageSummary.find(
                      (item) => item.operation === operation
                    )
                    return (
                      <div key={operation} className="bg-surface px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          {USAGE_OPERATION_LABELS[operation]}
                        </p>
                        <p className="mt-1 text-sm font-medium tabular-nums">
                          {formatUsd(row?.totalCostUsd ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(row?.eventCount ?? 0).toLocaleString()} events
                        </p>
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </SurfaceCard>

          {totalEvents > 0 ? (
            <SurfaceCard>
              <div className="border-b border-border-table px-4 py-3">
                <p className="text-sm font-medium">Usage logs</p>
                <p className="text-xs text-muted-foreground">
                  Voice calls, grading, and scenario generation for this org.
                  Click a call row to view details.
                </p>
              </div>
              {usageLoading && usageEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Loading logs…
                </p>
              ) : usageEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No usage events yet.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>When</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageEvents.map((event) => {
                        const callId =
                          event.resourceId &&
                          (event.operation === 'voice_call' ||
                            event.operation === 'call_grade')
                            ? event.resourceId
                            : null
                        const isSelected = callId
                          ? selectedCallId === callId
                          : false

                        return (
                          <TableRow
                            key={event.id}
                            tabIndex={callId ? 0 : undefined}
                            onClick={
                              callId
                                ? () => openCall(callId)
                                : undefined
                            }
                            onKeyDown={
                              callId
                                ? (keyEvent) => {
                                    if (
                                      keyEvent.key === 'Enter' ||
                                      keyEvent.key === ' '
                                    ) {
                                      keyEvent.preventDefault()
                                      openCall(callId)
                                    }
                                  }
                                : undefined
                            }
                            className={cn(
                              callId && 'cursor-pointer transition-colors',
                              callId && 'focus-visible:outline-none',
                              isSelected && 'bg-surface-hover/40'
                            )}
                          >
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatDateTimeShort(event.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {USAGE_OPERATION_LABELS[event.operation]}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs text-muted-foreground">
                              {formatUsageUnits(event.operation, event.units)}
                              {event.metadata.simulated ? ' · simulated' : ''}
                              {callId ? (
                                <span className="text-foreground">
                                  {' · View call'}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatUsd(event.costUsd)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <LoadMoreButton
                    hasMore={usageHasMore}
                    loading={usageLoadingMore}
                    onLoadMore={() => void loadMoreUsage()}
                  />
                </>
              )}
            </SurfaceCard>
          ) : null}

          {isSuspended ? (
            <Alert>
              <Prohibit />
              <AlertTitle>Organisation suspended</AlertTitle>
              <AlertDescription>
                Team members cannot sign in or use the platform until this
                organisation is unsuspended.
              </AlertDescription>
            </Alert>
          ) : null}

          {invites.length > 0 ? (
            <SurfaceCard>
              <div className="border-b border-border-table px-4 py-3">
                <p className="text-sm font-medium">
                  Pending invites ({invites.length})
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
                        <Badge variant={roleBadgeVariant(invite.role)}>
                          {formatRole(invite.role)}
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
                              void revokeOrgInvite(invite.id).then((result) => {
                                if (result.error) setActionError(result.error)
                              })
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

          <SurfaceCard>
            <div className="border-b border-border-table px-4 py-3">
              <p className="text-sm font-medium">Users ({members.length})</p>
            </div>
            {members.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No users yet. Invite an organisation admin to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={roleBadgeVariant(member.role)}>
                            {formatRole(member.role)}
                          </Badge>
                          {member.suspendedAt ? (
                            <Badge variant="destructive">Suspended</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {member.suspendedAt ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={saving}
                              onClick={() => {
                                setActionError(null)
                                void unsuspendMember(member.id).then(
                                  (result) => {
                                    if (result.error) {
                                      setActionError(result.error)
                                    }
                                  }
                                )
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
                                void suspendMember(member.id).then(
                                  (result) => {
                                    if (result.error) {
                                      setActionError(result.error)
                                    }
                                  }
                                )
                              }}
                            >
                              <Prohibit />
                              Suspend
                            </Button>
                          )}
                          <ImpersonateUserButton userId={member.id} />
                        </div>
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
                    {calls.map((call) => {
                      const isSelected = selectedCallId === call.id
                      return (
                        <TableRow
                          key={call.id}
                          tabIndex={0}
                          onClick={() => openCall(call.id)}
                          onKeyDown={(keyEvent) => {
                            if (
                              keyEvent.key === 'Enter' ||
                              keyEvent.key === ' '
                            ) {
                              keyEvent.preventDefault()
                              openCall(call.id)
                            }
                          }}
                          className={cn(
                            'cursor-pointer transition-colors',
                            'focus-visible:outline-none',
                            isSelected && 'bg-surface-hover/40'
                          )}
                        >
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
                      )
                    })}
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
            <DialogTitle>Invite organisation admin</DialogTitle>
            <DialogDescription>
              They will join as the organisation owner and complete onboarding.
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
              <FieldLabel htmlFor="org-admin-email">Email</FieldLabel>
              <Input
                id="org-admin-email"
                type="email"
                autoFocus
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="admin@company.com"
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
              disabled={!inviteEmail.trim()}
              onClick={() => void onInvite()}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organisation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {org?.name}, all team members, locations,
              calls, and related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onDeleteOrg()}
            >
              Delete organisation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
    {callDetailPanel}
    </>
  )
}
