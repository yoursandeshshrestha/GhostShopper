import type { ProfileRole } from '@/components/auth/AuthProvider'

export function isPlatformAdmin(role: ProfileRole | null | undefined) {
  return role === 'superadmin'
}

export function appHome(role: ProfileRole | null | undefined) {
  return isPlatformAdmin(role) ? '/admin' : '/dashboard'
}

export function isPlatformPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function canManageOrg(role: ProfileRole | null | undefined) {
  return role === 'owner' || role === 'admin'
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
  if (!role || isPlatformAdmin(role)) return false
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

  if (isPlatformAdmin(role)) {
    return isPlatformPath(href)
  }

  if (isPlatformPath(href)) return false

  if (role === 'location_viewer') {
    return (
      href === '/dashboard' ||
      href === '/review' ||
      href.startsWith('/review/') ||
      href === '/settings' ||
      href === '/support'
    )
  }

  if (href === '/schedule' || href === '/new-call') {
    return canStartCalls(role)
  }

  return href !== '/setup'
}

export function showNewCallCta(role: ProfileRole | null | undefined) {
  return canStartCalls(role)
}
