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
}

export interface Organisation {
  id: string
  name: string
  industry: string | null
  attestationSignedAt: string | null
  attestationSignedBy: string | null
  setupCompleted: boolean
  setupStep: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  organisation: Organisation | null
  loading: boolean
  signInWithMagicLink: (
    email: string,
    redirectTo?: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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

async function loadMembership(userId: string): Promise<{
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
      orgs (
        id,
        name,
        industry,
        attestation_signed_at,
        attestation_signed_by,
        setup_completed,
        setup_step
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
        }
      : null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMembership = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setOrganisation(null)
      return
    }

    const membership = await loadMembership(userId)
    setProfile(membership.profile)
    setOrganisation(membership.organisation)
  }, [])

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
          emailRedirectTo:
            redirectTo ?? `${window.location.origin}/auth/callback`,
        },
      })
      return { error: error?.message ?? null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setOrganisation(null)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      organisation,
      loading,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      createOrganisation,
      signAttestation,
      acceptInvitation,
    }),
    [
      session,
      profile,
      organisation,
      loading,
      signInWithMagicLink,
      signOut,
      refreshProfile,
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
