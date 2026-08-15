import type { ProfileRole } from '@/components/auth/AuthProvider'

export function canManageOrg(role: ProfileRole | null | undefined) {
  return role === 'owner' || role === 'admin' || role === 'superadmin'
}

/** Agents and scorecards — operational training config. */
export function canManageTrainingConfig(role: ProfileRole | null | undefined) {
  return canManageOrg(role) || role === 'coach'
}

/** Locations — org structure; admin-only writes. */
export function canManageLocations(role: ProfileRole | null | undefined) {
  return canManageOrg(role)
}

export function canViewLocations(role: ProfileRole | null | undefined) {
  if (!role) return false
  if (role === 'superadmin') return true
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'coach' ||
    role === 'location_viewer'
  )
}

export function canStartCalls(role: ProfileRole | null | undefined) {
  return canManageOrg(role) || role === 'coach'
}

export function canReviewCalls(role: ProfileRole | null | undefined) {
  return (
    canManageOrg(role) ||
    role === 'coach' ||
    role === 'location_viewer'
  )
}

export function canAccessNav(
  href: string,
  role: ProfileRole | null | undefined
) {
  if (!role) return false
  if (role === 'superadmin') return true

  if (role === 'location_viewer') {
    return (
      href === '/dashboard' ||
      href === '/review' ||
      href.startsWith('/review/') ||
      href === '/settings' ||
      href === '/support'
    )
  }

  return href !== '/setup'
}

export function showNewCallCta(role: ProfileRole | null | undefined) {
  return canStartCalls(role)
}
