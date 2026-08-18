import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { authCallbackUrl } from '@/lib/auth-callback-url'
import {
  clearImpersonationSnapshot,
  readImpersonationSnapshot,
  writeImpersonationSnapshot,
} from '@/lib/impersonation'

export type OrgRole = 'owner' | 'admin' | 'coach' | 'location_viewer'
export type ProfileRole = OrgRole | 'superadmin'

export interface Profile {
  id: string
  email: string
  fullName: string | null
  role: ProfileRole
  orgId: string | null
  assignedLocationId: string | null
  onboardingCompletedAt: string | null
  suspendedAt: string | null
}

export interface Organisation {
  id: string
  name: string
  industry: string | null
  attestationSignedAt: string | null
  attestationSignedBy: string | null
  setupCompleted: boolean
  setupStep: string
  suspendedAt: string | null
}

interface ImpersonationState {
  profile: Profile
  organisation: Organisation | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  organisation: Organisation | null
  effectiveProfile: Profile | null
  effectiveOrganisation: Organisation | null
  isImpersonating: boolean
  loading: boolean
  signInWithMagicLink: (
    email: string,
    redirectTo?: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  startImpersonation: (userId: string) => Promise<{
    error: string | null
    role?: ProfileRole
  }>
  stopImpersonation: () => void
  createOrganisation: (input: {
    name: string
    industry: string
    fullName: string
  }) => Promise<{ error: string | null; orgId?: string }>
  signAttestation: (input: {
    signedBy: string
    jobTitle: string
  }) => Promise<{ error: string | null }>
  acceptInvitation: (input: {
    token: string
    fullName?: string
  }) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export async function loadMembership(userId: string): Promise<{
  profile: Profile | null
  organisation: Organisation | null
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      full_name,
      role,
      org_id,
      assigned_location_id,
      onboarding_completed_at,
      suspended_at,
      orgs (
        id,
        name,
        industry,
        attestation_signed_at,
        attestation_signed_by,
        setup_completed,
        setup_step,
        suspended_at
      )
    `
    )
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return { profile: null, organisation: null }
  }

  const orgRaw = data.orgs
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw

  return {
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role as ProfileRole,
      orgId: data.org_id,
      assignedLocationId: data.assigned_location_id,
      onboardingCompletedAt: data.onboarding_completed_at,
      suspendedAt: (data.suspended_at as string | null) ?? null,
    },
    organisation: org
      ? {
          id: org.id,
          name: org.name,
          industry: org.industry,
          attestationSignedAt: org.attestation_signed_at,
          attestationSignedBy: org.attestation_signed_by,
          setupCompleted: Boolean(org.setup_completed),
          setupStep: org.setup_step ?? 'welcome',
          suspendedAt: (org.suspended_at as string | null) ?? null,
        }
      : null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(
    null
  )
  const [loading, setLoading] = useState(true)

  const restoreImpersonation = useCallback(
    async (actorProfile: Profile | null) => {
      if (actorProfile?.role !== 'superadmin') {
        clearImpersonationSnapshot()
        setImpersonation(null)
        return
      }

      const snapshot = readImpersonationSnapshot()
      if (!snapshot) {
        setImpersonation(null)
        return
      }

      if (snapshot.userId === actorProfile.id) {
        clearImpersonationSnapshot()
        setImpersonation(null)
        return
      }

      const membership = await loadMembership(snapshot.userId)
      if (!membership.profile || membership.profile.role === 'superadmin') {
        clearImpersonationSnapshot()
        setImpersonation(null)
        return
      }

      setImpersonation({
        profile: membership.profile,
        organisation: membership.organisation,
      })
    },
    []
  )

  const refreshMembership = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setOrganisation(null)
      return
    }

    let membership = await loadMembership(userId)
    if (!membership.profile) {
      const { error: claimError } = await supabase.rpc(
        'claim_pending_invitation'
      )
      if (!claimError) {
        membership = await loadMembership(userId)
      }
    }
    setProfile(membership.profile)
    setOrganisation(membership.organisation)
    await restoreImpersonation(membership.profile)
  }, [restoreImpersonation])

  const refreshProfile = useCallback(async () => {
    await refreshMembership(session?.user.id)
  }, [refreshMembership, session?.user.id])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await refreshMembership(data.session?.user.id)
      if (mounted) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void refreshMembership(nextSession?.user.id).then(() => {
        if (mounted) setLoading(false)
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshMembership])

  const signInWithMagicLink = useCallback(
    async (email: string, redirectTo?: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authCallbackUrl(redirectTo),
        },
      })
      return { error: error?.message ?? null }
    },
    []
  )

  const signOut = useCallback(async () => {
    clearImpersonationSnapshot()
    setImpersonation(null)
    await supabase.auth.signOut()
    setProfile(null)
    setOrganisation(null)
  }, [])

  const startImpersonation = useCallback(
    async (userId: string) => {
      if (profile?.role !== 'superadmin') {
        return { error: 'Only platform superadmins can impersonate users.' }
      }

      if (userId === profile.id) {
        return { error: 'You cannot impersonate yourself.' }
      }

      const membership = await loadMembership(userId)
      if (!membership.profile) {
        return { error: 'User not found.' }
      }

      if (membership.profile.role === 'superadmin') {
        return { error: 'You cannot impersonate another superadmin.' }
      }

      if (!membership.profile.orgId) {
        return { error: 'This user is not part of an organisation.' }
      }

      writeImpersonationSnapshot({
        userId: membership.profile.id,
        orgId: membership.profile.orgId,
        startedAt: new Date().toISOString(),
      })

      setImpersonation({
        profile: membership.profile,
        organisation: membership.organisation,
      })

      return { error: null, role: membership.profile.role }
    },
    [profile?.id, profile?.role]
  )

  const stopImpersonation = useCallback(() => {
    clearImpersonationSnapshot()
    setImpersonation(null)
  }, [])

  const createOrganisation = useCallback(
    async (input: { name: string; industry: string; fullName: string }) => {
      const { data, error } = await supabase.rpc('create_org_with_owner', {
        org_name: input.name,
        org_industry: input.industry,
        owner_full_name: input.fullName,
      })

      if (error) {
        return { error: error.message }
      }

      await refreshMembership(session?.user.id)
      return { error: null, orgId: data as string }
    },
    [refreshMembership, session?.user.id]
  )

  const signAttestation = useCallback(
    async (input: { signedBy: string; jobTitle: string }) => {
      const { error } = await supabase.rpc('sign_org_attestation', {
        signed_by: input.signedBy,
        job_title: input.jobTitle,
      })

      if (error) {
        return { error: error.message }
      }

      await refreshMembership(session?.user.id)
      return { error: null }
    },
    [refreshMembership, session?.user.id]
  )

  const acceptInvitation = useCallback(
    async (input: { token: string; fullName?: string }) => {
      const { error } = await supabase.rpc('accept_invitation', {
        invite_token: input.token,
        acceptor_full_name: input.fullName ?? null,
      })

      if (error) {
        return { error: error.message }
      }

      await refreshMembership(session?.user.id)
      return { error: null }
    },
    [refreshMembership, session?.user.id]
  )

  const effectiveProfile = impersonation?.profile ?? profile
  const effectiveOrganisation = impersonation?.organisation ?? organisation
  const isImpersonating = impersonation != null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      organisation,
      effectiveProfile,
      effectiveOrganisation,
      isImpersonating,
      loading,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      startImpersonation,
      stopImpersonation,
      createOrganisation,
      signAttestation,
      acceptInvitation,
    }),
    [
      session,
      profile,
      organisation,
      effectiveProfile,
      effectiveOrganisation,
      isImpersonating,
      loading,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      startImpersonation,
      stopImpersonation,
      createOrganisation,
      signAttestation,
      acceptInvitation,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
