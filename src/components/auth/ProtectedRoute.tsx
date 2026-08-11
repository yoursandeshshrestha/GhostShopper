import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  useAuth,
  type Organisation,
  type Profile,
} from '@/components/auth/AuthProvider'
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

export function needsOnboarding(
  profile: Profile | null,
  organisation: Organisation | null
) {
  return !profile || needsAttestation(profile, organisation)
}

/** Requires session + profile (+ attestation for owners). */
export function ProtectedRoute() {
  const { session, profile, organisation, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (needsOnboarding(profile, organisation)) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}

/** For /onboarding — session required; stay until profile + attestation done. */
export function OnboardingRoute() {
  const { session, profile, organisation, loading } = useAuth()

  if (loading) return <AuthLoading />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!needsOnboarding(profile, organisation)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/** Login / public pages — bounce finished users to app. */
export function PublicOnlyRoute() {
  const { session, profile, organisation, loading } = useAuth()

  if (loading) return <AuthLoading />

  if (session && !needsOnboarding(profile, organisation)) {
    return <Navigate to="/" replace />
  }

  if (session && needsOnboarding(profile, organisation)) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
