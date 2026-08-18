import { useState } from 'react'
import {
  Buildings,
  Check,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react'
import { AppPage } from '@/components/layout/AppPage'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeSelect } from '@/components/theme/ThemeSelect'
import { IndustryField } from '@/components/form/IndustryField'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import { SettingsRow, SettingsSection } from './components/SettingsSection'
import { formatRole, getInitials, roleBadgeVariant } from './lib'

const fieldClassName = cn(
  'h-9 w-full max-w-md rounded-md border border-input bg-input/30 px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

const NAV_ITEMS = [
  { value: 'organisation', label: 'Organisation', icon: Buildings },
  { value: 'profile', label: 'Profile', icon: UserCircle },
] as const

export function SettingsPage() {
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
    orgDirty,
    profileDirty,
    saveOrganisation,
    saveProfile,
  } = useSettings()

  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
                <IndustryField
                  id="org-industry"
                  value={industry}
                  onChange={setIndustry}
                  disabled={!canManage}
                  triggerClassName={fieldClassName}
                />
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
        </div>
      </Tabs>
    </AppPage>
  )
}
