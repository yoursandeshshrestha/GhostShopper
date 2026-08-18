import { useAuth } from '@/components/auth/AuthProvider'
import type { Organisation, Profile, ProfileRole } from '@/components/auth/AuthProvider'

export interface OrgContext {
  profile: Profile | null
  organisation: Organisation | null
  orgId: string | null
  role: ProfileRole | null
  isImpersonating: boolean
}

export function useOrgContext(): OrgContext {
  const {
    effectiveProfile,
    effectiveOrganisation,
    isImpersonating,
  } = useAuth()

  const orgId =
    effectiveOrganisation?.id ?? effectiveProfile?.orgId ?? null

  return {
    profile: effectiveProfile,
    organisation: effectiveOrganisation,
    orgId,
    role: effectiveProfile?.role ?? null,
    isImpersonating,
  }
}
