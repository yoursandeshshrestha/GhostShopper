import { useNavigate } from 'react-router-dom'
import { SignOut, UserSwitch } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { formatRole } from '@/pages/settings/lib'

export function ImpersonationBanner() {
  const navigate = useNavigate()
  const { effectiveProfile, effectiveOrganisation, stopImpersonation } =
    useAuth()

  if (!effectiveProfile) return null

  function handleExit() {
    stopImpersonation()
    navigate('/admin', { replace: true })
  }

  const displayName =
    effectiveProfile.fullName?.trim() || effectiveProfile.email
  const orgName = effectiveOrganisation?.name ?? 'Unknown organisation'

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-50">
      <div className="flex min-w-0 items-center gap-2">
        <UserSwitch className="size-4 shrink-0" weight="fill" />
        <p className="truncate">
          Viewing as{' '}
          <span className="font-medium">{displayName}</span>
          {' · '}
          {formatRole(effectiveProfile.role)}
          {' · '}
          {orgName}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-500/40 bg-background/80 hover:bg-background"
        onClick={handleExit}
      >
        <SignOut />
        Exit impersonation
      </Button>
    </div>
  )
}
