import { useState } from 'react'
import {
  Buildings,
  Check,
  Copy,
  Plus,
  Trash,
  UserCircle,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import type { OrgRole } from '@/components/auth/AuthProvider'
import { useAuth } from '@/components/auth/AuthProvider'
import { AppPage } from '@/components/layout/AppPage'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeSelect } from '@/components/theme/ThemeSelect'
import { useSettings } from '@/hooks/use-settings'
import { INDUSTRIES } from '@/types/org'
import { cn } from '@/lib/utils'
import { SettingsRow, SettingsSection } from './components/SettingsSection'
import { formatRole, getInitials, roleBadgeVariant } from './lib'

const fieldClassName = cn(
  'h-9 w-full max-w-md rounded-md border border-input bg-input/30 px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

const ROLE_OPTIONS: { value: Exclude<OrgRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'location_viewer', label: 'Location viewer' },
]

const NAV_ITEMS = [
  { value: 'organisation', label: 'Organisation', icon: Buildings },
  { value: 'profile', label: 'Profile', icon: UserCircle },
  { value: 'team', label: 'Team', icon: UsersThree },
] as const

export function SettingsPage() {
  const { profile } = useAuth()
  const {
    loading,
    saving,
    error,
    canManage,
    orgName,
    setOrgName,
    industry,
    setIndustry,
    fullName,
    setFullName,
    email,
    role,
    members,
    invites,
    locations,
    orgDirty,
    profileDirty,
    saveOrganisation,
    saveProfile,
    createInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
  } = useSettings()

  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] =
    useState<Exclude<OrgRole, 'owner'>>('admin')
  const [inviteLocationId, setInviteLocationId] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  function flashSuccess(message: string) {
    setSuccessMessage(message)
    window.setTimeout(() => setSuccessMessage(null), 3000)
  }

  async function onSaveOrg() {
    setActionError(null)
    const result = await saveOrganisation()
    if (result.error) {
      setActionError(result.error)
      return
    }
    flashSuccess('Organisation updated')
  }

  async function onSaveProfile() {
    setActionError(null)
    const result = await saveProfile()
    if (result.error) {
      setActionError(result.error)
      return
    }
    flashSuccess('Profile updated')
  }

  async function onInvite() {
    setActionError(null)
    setSuccessMessage(null)
    const result = await createInvite({
      email: inviteEmail,
      role: inviteRole,
      assignedLocationId:
        inviteRole === 'location_viewer' ? inviteLocationId || null : null,
    })
    if (result.error) {
      setActionError(result.error)
      if (result.inviteId) {
        setInviteEmail('')
        setInviteRole('admin')
        setInviteLocationId('')
      }
      return
    }
    setInviteEmail('')
    setInviteRole('admin')
    setInviteLocationId('')
    flashSuccess('Invite sent')
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

  const locationNameById = new Map(locations.map((loc) => [loc.id, loc.name]))

  return (
    <AppPage title="Settings" loading={loading}>
      {error || actionError ? (
        <Alert variant={actionError?.includes('Invite created') ? 'default' : 'destructive'}>
          <WarningCircle weight="fill" />
          <AlertTitle>
            {actionError?.includes('Invite created')
              ? 'Invite created'
              : 'Something went wrong'}
          </AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <Check weight="bold" />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        defaultValue="organisation"
        orientation="vertical"
        className="flex flex-col gap-6 lg:flex-row lg:gap-10"
      >
        <TabsList
          variant="line"
          className="h-auto w-full shrink-0 justify-start gap-0 bg-transparent p-0 lg:w-44"
        >
          {NAV_ITEMS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="w-full justify-start gap-2.5 rounded-md px-3 py-2 after:hidden data-active:bg-sidebar-accent data-active:shadow-none"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {item.value === 'team' && invites.length > 0 ? (
                <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
                  {invites.length}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0 flex-1 lg:max-w-2xl">
          <TabsContent value="organisation" className="mt-0 outline-none">
            <SettingsSection
              title="Organisation"
              description="Your workspace name and industry — visible to everyone on the team."
              footer={
                canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    loading={saving}
                    disabled={!orgDirty}
                    onClick={() => void onSaveOrg()}
                  >
                    Save changes
                  </Button>
                ) : null
              }
            >
              <SettingsRow label="Name" htmlFor="org-name">
                <Input
                  id="org-name"
                  className={fieldClassName}
                  value={orgName}
                  disabled={!canManage}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </SettingsRow>
              <SettingsRow
                label="Industry"
                description="Helps tailor default scorecard suggestions."
              >
                <Select
                  value={industry || undefined}
                  disabled={!canManage}
                  onValueChange={(value) => setIndustry(value ?? '')}
                >
                  <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                    <SelectValue placeholder="Choose industry" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[200]">
                    {INDUSTRIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="profile" className="mt-0 outline-none">
            <SettingsSection
              title="Profile"
              description="Your personal details within this workspace."
              footer={
                <Button
                  type="button"
                  size="sm"
                  loading={saving}
                  disabled={!profileDirty}
                  onClick={() => void onSaveProfile()}
                >
                  Save changes
                </Button>
              }
            >
              <div className="flex items-center gap-4 px-5 py-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-medium text-primary">
                  {getInitials(fullName, email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {fullName || email}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {email}
                  </p>
                  {role ? (
                    <Badge variant={roleBadgeVariant(role)} className="mt-2">
                      {formatRole(role)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <SettingsRow label="Full name" htmlFor="full-name">
                <Input
                  id="full-name"
                  className={fieldClassName}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </SettingsRow>
              <SettingsRow label="Email" description="Managed by your login.">
                <Input className={fieldClassName} value={email} disabled />
              </SettingsRow>
              <SettingsRow label="Role" description="Assigned by an owner or admin.">
                <Input
                  className={fieldClassName}
                  value={role ? formatRole(role) : ''}
                  disabled
                />
              </SettingsRow>
              <SettingsRow
                label="Appearance"
                description="Choose light, dark, or match your system."
              >
                <ThemeSelect triggerClassName={fieldClassName} />
              </SettingsRow>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="team" className="mt-0 space-y-8 outline-none">
            {canManage ? (
              <SettingsSection
                title="Invite teammate"
                description="They'll receive an email with a link to join your workspace. If email delivery fails, copy the invite link from Pending invites."
                footer={
                  <Button
                    type="button"
                    size="sm"
                    loading={saving}
                    disabled={!inviteEmail.trim()}
                    onClick={() => void onInvite()}
                  >
                    <Plus />
                    Send invite
                  </Button>
                }
              >
                <SettingsRow label="Email" htmlFor="invite-email">
                  <Input
                    id="invite-email"
                    type="email"
                    className={fieldClassName}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                  />
                </SettingsRow>
                <SettingsRow label="Role">
                  <Select
                    value={inviteRole}
                    onValueChange={(value) =>
                      setInviteRole(
                        (value as Exclude<OrgRole, 'owner'>) || 'admin'
                      )
                    }
                  >
                    <SelectTrigger className={cn(fieldClassName, 'justify-between')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200]">
                      {ROLE_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsRow>
                {inviteRole === 'location_viewer' ? (
                  <SettingsRow
                    label="Location"
                    description="Viewers only see data for this location."
                  >
                    <Select
                      value={inviteLocationId || undefined}
                      onValueChange={(value) => setInviteLocationId(value ?? '')}
                    >
                      <SelectTrigger
                        className={cn(fieldClassName, 'justify-between')}
                      >
                        <SelectValue placeholder="Choose location" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-[200]">
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                ) : null}
              </SettingsSection>
            ) : null}

            <SettingsSection
              title="Members"
              description={`${members.length} ${members.length === 1 ? 'person' : 'people'} in this workspace.`}
            >
              {members.length === 0 ? (
                <div className="px-5 py-8">
                  <PageEmptyState
                    title="No members yet"
                    description="Invite teammates to collaborate on mystery-shop calls."
                    className="min-h-0 border-0 py-0"
                  />
                </div>
              ) : (
                members.map((member) => {
                  const canEditMember =
                    canManage &&
                    member.role !== 'owner' &&
                    member.id !== profile?.id

                  return (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                      {getInitials(member.fullName, member.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {member.fullName || member.email}
                      </p>
                      {member.fullName ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {canEditMember ? (
                        <>
                          <Select
                            value={
                              member.role === 'superadmin'
                                ? 'admin'
                                : member.role
                            }
                            onValueChange={(value) => {
                              const nextRole =
                                (value as Exclude<OrgRole, 'owner'>) || 'admin'
                              void updateMemberRole({
                                memberId: member.id,
                                role: nextRole,
                                assignedLocationId:
                                  nextRole === 'location_viewer'
                                    ? member.assignedLocationId ??
                                      locations[0]?.id ??
                                      null
                                    : null,
                              }).then((result) => {
                                if (result.error) setActionError(result.error)
                              })
                            }}
                          >
                            <SelectTrigger
                              className={cn(fieldClassName, 'w-[148px] justify-between')}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[200]">
                              {ROLE_OPTIONS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {member.role === 'location_viewer' ? (
                            <Select
                              value={member.assignedLocationId ?? undefined}
                              onValueChange={(value) => {
                                void updateMemberRole({
                                  memberId: member.id,
                                  role: 'location_viewer',
                                  assignedLocationId: value ?? null,
                                })
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  fieldClassName,
                                  'w-[160px] justify-between'
                                )}
                              >
                                <SelectValue placeholder="Location" />
                              </SelectTrigger>
                              <SelectContent position="popper" className="z-[200]">
                                {locations.map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${member.fullName || member.email}`}
                            onClick={() => setPendingRemoveId(member.id)}
                          >
                            <Trash />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant={roleBadgeVariant(member.role)}>
                            {formatRole(member.role)}
                          </Badge>
                          {member.assignedLocationId ? (
                            <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">
                              {locationNameById.get(member.assignedLocationId) ??
                                'Assigned location'}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  )
                })
              )}
            </SettingsSection>

            {invites.length > 0 ? (
              <SettingsSection
                title="Pending invites"
                description="Links expire after seven days. Copy to resend manually."
              >
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invite.email}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
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
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onCopy(invite.id, invite.token)}
                      >
                        {copiedId === invite.id ? (
                          <>
                            <Check />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy />
                            Copy link
                          </>
                        )}
                      </Button>
                      {canManage ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Revoke invite"
                          onClick={() => void revokeInvite(invite.id)}
                        >
                          <Trash />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </SettingsSection>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>

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
