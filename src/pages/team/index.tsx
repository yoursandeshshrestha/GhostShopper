import { useState } from 'react'
import {
  Check,
  Copy,
  DotsThreeVertical,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import type { OrgRole } from '@/components/auth/AuthProvider'
import { useOrgContext } from '@/hooks/use-org-context'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSettings, type TeamMember } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import {
  TEAM_ROLE_OPTIONS,
  formatRole,
  getInitials,
  roleBadgeVariant,
} from '@/pages/settings/lib'

const fieldClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

export function TeamPage() {
  const { profile } = useOrgContext()
  const {
    loading,
    saving,
    error,
    canManage,
    members,
    invites,
    locations,
    createInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
  } = useSettings()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] =
    useState<Exclude<OrgRole, 'owner'>>('admin')
  const [inviteLocationId, setInviteLocationId] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] =
    useState<Exclude<OrgRole, 'owner'>>('admin')
  const [editLocationId, setEditLocationId] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const locationNameById = new Map(locations.map((loc) => [loc.id, loc.name]))

  function closeInvite() {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('admin')
    setInviteLocationId('')
    setInviteError(null)
  }

  async function onInvite() {
    setInviteError(null)
    const result = await createInvite({
      email: inviteEmail,
      role: inviteRole,
      assignedLocationId:
        inviteRole === 'location_viewer' ? inviteLocationId || null : null,
    })
    if (result.error) {
      setInviteError(result.error)
      return
    }
    closeInvite()
  }

  function openEditMember(member: TeamMember) {
    setActionError(null)
    setEditError(null)
    setEditingMember(member)
    setEditRole(
      member.role === 'superadmin' || member.role === 'owner'
        ? 'admin'
        : member.role
    )
    setEditLocationId(member.assignedLocationId ?? '')
  }

  function closeEditMember() {
    setEditingMember(null)
    setEditError(null)
    setEditLocationId('')
    setEditRole('admin')
  }

  async function onSaveMember() {
    if (!editingMember) return
    setEditError(null)
    const result = await updateMemberRole({
      memberId: editingMember.id,
      role: editRole,
      assignedLocationId:
        editRole === 'location_viewer' ? editLocationId || null : null,
    })
    if (result.error) {
      setEditError(result.error)
      return
    }
    closeEditMember()
  }

  async function onCopy(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invite/${token}`
      )
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 2000)
    } catch {
      setActionError('Could not copy invite link')
    }
  }

  return (
    <AppPage
      title="Team"
      count={members.length || undefined}
      loading={loading}
      actions={
        canManage ? (
          <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
            <Plus />
            Invite teammate
          </Button>
        ) : undefined
      }
    >
      {error || actionError ? (
        <Alert
          variant={
            actionError?.includes('Invite created') ? 'default' : 'destructive'
          }
        >
          <WarningCircle weight="fill" />
          <AlertTitle>
            {actionError?.includes('Invite created')
              ? 'Invite created'
              : 'Something went wrong'}
          </AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={roleBadgeVariant(invite.role)}>
                        {formatRole(invite.role)}
                      </Badge>
                      {invite.assignedLocationId ? (
                        <span className="text-xs text-muted-foreground">
                          {locationNameById.get(invite.assignedLocationId) ??
                            'Location'}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Invite actions for ${invite.email}`}
                          >
                            <DotsThreeVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => void onCopy(invite.id, invite.token)}
                          >
                            {copiedId === invite.id ? <Check /> : <Copy />}
                            {copiedId === invite.id ? 'Copied' : 'Copy link'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setActionError(null)
                              void revokeInvite(invite.id).then((result) => {
                                if (result.error) setActionError(result.error)
                              })
                            }}
                          >
                            <Trash />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceCard>
      ) : null}

      {members.length === 0 ? (
        <PageEmptyState
          title="No members yet"
          description="Invite teammates to collaborate on mystery-shop calls."
        />
      ) : (
        <SurfaceCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Location</TableHead>
                {canManage ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const canEditMember =
                  canManage &&
                  member.role !== 'owner' &&
                  member.id !== profile?.id

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {getInitials(member.fullName, member.email)}
                        </div>
                        <span className="font-medium">
                          {member.fullName || 'No name'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(member.role)}>
                        {formatRole(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.assignedLocationId ? (
                        <span className="text-muted-foreground">
                          {locationNameById.get(member.assignedLocationId) ??
                            'Assigned location'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          All locations
                        </span>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {canEditMember ? (
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Actions for ${member.fullName || member.email}`}
                                >
                                  <DotsThreeVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => openEditMember(member)}
                                >
                                  <PencilSimple />
                                  Edit role & location
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    setPendingRemoveId(member.id)
                                  }
                                >
                                  <Trash />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
            <DialogTitle>Invite teammate</DialogTitle>
            <DialogDescription>
              They get a magic-link invite to join this organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                autoFocus
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel>Role</FieldLabel>
              <Select
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole((value as Exclude<OrgRole, 'owner'>) || 'admin')
                }
              >
                <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-200">
                  {TEAM_ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {inviteRole === 'location_viewer' ? (
              <Field className="gap-2">
                <FieldLabel>Location</FieldLabel>
                <Select
                  value={inviteLocationId || undefined}
                  onValueChange={(value) => setInviteLocationId(value ?? '')}
                >
                  <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                    <SelectValue placeholder="Choose location" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-200">
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {inviteError ? (
              <p className="text-sm text-destructive">{inviteError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeInvite}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={saving}
              disabled={
                !inviteEmail.trim() ||
                (inviteRole === 'location_viewer' && !inviteLocationId)
              }
              onClick={() => void onInvite()}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) closeEditMember()
        }}
      >
        <DialogContent size="sm" className="gap-0">
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>
              Change the role for{' '}
              {editingMember?.fullName || editingMember?.email}. Location
              viewers only see one assigned location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Field className="gap-2">
              <FieldLabel>Role</FieldLabel>
              <Select
                value={editRole}
                onValueChange={(value) => {
                  const nextRole =
                    (value as Exclude<OrgRole, 'owner'>) || 'admin'
                  setEditRole(nextRole)
                  if (nextRole === 'location_viewer' && !editLocationId) {
                    setEditLocationId(
                      editingMember?.assignedLocationId ??
                        locations[0]?.id ??
                        ''
                    )
                  }
                }}
              >
                <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-200">
                  {TEAM_ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {editRole === 'location_viewer' ? (
              <Field className="gap-2">
                <FieldLabel>Location</FieldLabel>
                <Select
                  value={editLocationId || undefined}
                  onValueChange={(value) => setEditLocationId(value ?? '')}
                >
                  <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                    <SelectValue placeholder="Choose location" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-200">
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditMember}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={saving}
              disabled={
                editRole === 'location_viewer' && !editLocationId
              }
              onClick={() => void onSaveMember()}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingRemoveId)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingRemoveId) return
                void removeMember(pendingRemoveId).then((result) => {
                  if (!result.error) setPendingRemoveId(null)
                  else setActionError(result.error)
                })
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  )
}
