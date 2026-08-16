import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  useAuth,
  type Organisation,
  type Profile,
} from '@/components/auth/AuthProvider'
import { canAccessNav, appHome, isPlatformAdmin, isPlatformPath } from '@/lib/permissions'
import { Spinner } from '@/components/ui/spinner'

function AuthLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Spinner size="md" className="text-muted-foreground" />
    </div>
  )
}

/** Owners must sign attestation before using the app. */
export function needsAttestation(
  profile: Profile | null,
  organisation: Organisation | null
) {
  return (
    profile?.role === 'owner' &&
    organisation != null &&
    !organisation.attestationSignedAt
  )
}

/** Owners must finish the setup wizard before the dashboard. */
export function needsSetup(
  profile: Profile | null,
  organisation: Organisation | null
) {
  return (
    profile?.role === 'owner' &&
    organisation != null &&
    Boolean(organisation.attestationSignedAt) &&
    !organisation.setupCompleted
  )
}

/** Org create / join / attestation still outstanding. */
export function needsOrgOnboarding(
  profile: Profile | null,
  organisation: Organisation | null
) {
  return !profile || needsAttestation(profile, organisation)
}

export function needsOnboarding(
  profile: Profile | null,
  organisation: Organisation | null
) {
  return (
    needsOrgOnboarding(profile, organisation) ||
    needsSetup(profile, organisation)
  )
}

function destinationForIncomplete(
  profile: Profile | null,
  organisation: Organisation | null
) {
  if (needsOrgOnboarding(profile, organisation)) return '/onboarding'
  if (needsSetup(profile, organisation)) return '/setup'
  return appHome(profile?.role)
}

/** Requires session + profile (+ attestation/setup for owners). */
export function ProtectedRoute() {
  const { session, profile, organisation, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (needsOnboarding(profile, organisation)) {
    return (
      <Navigate
        to={destinationForIncomplete(profile, organisation)}
        replace
      />
    )
  }

  return <Outlet />
}

/** /onboarding — org create, invite join, attestation only. */
export function OnboardingRoute() {
  const { session, profile, organisation, loading } = useAuth()

  if (loading) return <AuthLoading />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (needsSetup(profile, organisation)) {
    return <Navigate to="/setup" replace />
  }

  if (!needsOrgOnboarding(profile, organisation)) {
    return <Navigate to={appHome(profile?.role)} replace />
  }

  return <Outlet />
}

/** /setup — first-time org setup wizard after attestation. */
export function SetupRoute() {
  const { session, profile, organisation, loading } = useAuth()

  if (loading) return <AuthLoading />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (needsOrgOnboarding(profile, organisation)) {
    return <Navigate to="/onboarding" replace />
  }

  if (!needsSetup(profile, organisation)) {
    return <Navigate to={appHome(profile?.role)} replace />
  }

  return <Outlet />
}

/** Blocks routes the user's role cannot access (coach, location viewer, etc.). */
export function NavAccessRoute() {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (canAccessNav(location.pathname, profile?.role ?? null)) {
    return <Outlet />
  }

  if (isPlatformAdmin(profile?.role) && !isPlatformPath(location.pathname)) {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to={appHome(profile?.role)} replace />
}

/** Login / public pages — bounce finished users to app. */
export function PublicOnlyRoute() {
  const { session, profile, organisation, loading } = useAuth()

  if (loading) return <AuthLoading />

  if (session && !needsOnboarding(profile, organisation)) {
    return <Navigate to={appHome(profile?.role)} replace />
  }

  if (session && needsOnboarding(profile, organisation)) {
    return (
      <Navigate
        to={destinationForIncomplete(profile, organisation)}
        replace
      />
    )
  }

  return <Outlet />
}
