import { useCallback, useEffect, useState } from 'react'
import type { OrgRole } from '@/components/auth/AuthProvider'
import { useAuth } from '@/components/auth/AuthProvider'
import { useOrgContext } from '@/hooks/use-org-context'
import { canManageOrg } from '@/lib/permissions'
import { deliverInviteEmail } from '@/lib/deliver-invite-email'
import { supabase } from '@/lib/supabase/client'
import { isOtherOptionComplete } from '@/lib/other-option'

export interface TeamMember {
  id: string
  email: string
  fullName: string | null
  role: OrgRole | 'superadmin'
  assignedLocationId: string | null
  suspendedAt: string | null
}

export interface PendingInvite {
  id: string
  email: string
  role: Exclude<OrgRole, 'owner'>
  assignedLocationId: string | null
  token: string
  expiresAt: string
  emailSent: boolean
}

export function useSettings() {
  const { refreshProfile } = useAuth()
  const { profile, organisation, orgId } = useOrgContext()
  const canManage = canManageOrg(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState(organisation?.name ?? '')
  const [industry, setIndustry] = useState(organisation?.industry ?? '')
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [orgBaseline, setOrgBaseline] = useState({ name: '', industry: '' })
  const [profileBaseline, setProfileBaseline] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [locations, setLocations] = useState<
    { id: string; name: string }[]
  >([])
  const [planLabel, setPlanLabel] = useState<string | null>(null)
  const [billingStatus, setBillingStatus] = useState<string>('audit')

  const refresh = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [membersRes, invitesRes, locationsRes, orgRes, subRes] =
      await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, assigned_location_id, suspended_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('invitations')
        .select(
          'id, email, role, assigned_location_id, token, expires_at, accepted_at'
        )
        .eq('org_id', orgId)
        .is('accepted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('locations')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
      supabase
        .from('orgs')
        .select('name, industry, subscription_status')
        .eq('id', orgId)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('tier, cadence, billing_period, status')
        .eq('org_id', orgId)
        .maybeSingle(),
    ])

    const firstError =
      membersRes.error?.message ||
      invitesRes.error?.message ||
      locationsRes.error?.message ||
      orgRes.error?.message ||
      subRes.error?.message ||
      null

    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    setMembers(
      (membersRes.data ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        fullName: (row.full_name as string | null) ?? null,
        role: row.role as TeamMember['role'],
        assignedLocationId:
          (row.assigned_location_id as string | null) ?? null,
        suspendedAt: (row.suspended_at as string | null) ?? null,
      }))
    )
    setInvites(
      (invitesRes.data ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        role: row.role as PendingInvite['role'],
        assignedLocationId:
          (row.assigned_location_id as string | null) ?? null,
        token: row.token as string,
        expiresAt: row.expires_at as string,
        emailSent: true,
      }))
    )
    setLocations(
      (locationsRes.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
      }))
    )
    if (orgRes.data) {
      const nextName = (orgRes.data.name as string) || ''
      const nextIndustry = (orgRes.data.industry as string) || ''
      setOrgName(nextName)
      setIndustry(nextIndustry)
      setOrgBaseline({ name: nextName, industry: nextIndustry })
      setBillingStatus(
        (orgRes.data.subscription_status as string | null) ?? 'audit'
      )
    }
    if (subRes.data) {
      const tier = String(subRes.data.tier)
      const period = String(subRes.data.billing_period)
      const cadence = String(subRes.data.cadence)
      const named = tier.charAt(0).toUpperCase() + tier.slice(1)
      const periodLabel = period === 'annual' ? 'annual' : 'monthly'
      const cadenceLabel = cadence === 'intensive' ? ', intensive' : ''
      setPlanLabel(`${named} (${periodLabel}${cadenceLabel})`)
    } else {
      setPlanLabel(null)
    }
    const nextFullName = profile?.fullName ?? ''
    setFullName(nextFullName)
    setProfileBaseline(nextFullName)
    setLoading(false)
  }, [orgId, profile?.fullName])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveOrganisation = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to edit the organisation.' }
    }
    if (!orgName.trim()) return { error: 'Organisation name is required.' }
    if (!isOtherOptionComplete(industry)) {
      return { error: 'Enter your industry, or pick one from the list.' }
    }

    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('orgs')
      .update({
        name: orgName.trim(),
        industry: industry || null,
      })
      .eq('id', orgId)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return { error: updateError.message }
    }

    setOrgBaseline({ name: orgName.trim(), industry: industry || '' })
    await refreshProfile()
    return { error: null }
  }, [canManage, industry, orgId, orgName, refreshProfile])

  const saveProfile = useCallback(async () => {
    if (!profile?.id) return { error: 'Not signed in.' }

    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', profile.id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return { error: updateError.message }
    }

    setProfileBaseline(fullName.trim())
    await refreshProfile()
    return { error: null }
  }, [fullName, profile?.id, refreshProfile])

  const createInvite = useCallback(
    async (input: {
      email: string
      role: Exclude<OrgRole, 'owner'>
      assignedLocationId: string | null
    }) => {
      if (!canManage) {
        return { error: 'You do not have permission to invite teammates.' }
      }
      if (!input.email.trim()) return { error: 'Email is required.' }
      if (input.role === 'location_viewer' && !input.assignedLocationId) {
        return { error: 'Assign a location for Location Viewer.' }
      }

      setSaving(true)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc('create_invitation', {
        invite_email: input.email.trim(),
        invite_role: input.role,
        invite_location_id: input.assignedLocationId,
      })

      if (rpcError || !data) {
        const message = rpcError?.message ?? 'Could not create invite.'
        setSaving(false)
        setError(message)
        return { error: message }
      }

      const saved = data as {
        id: string
        email: string
        role: PendingInvite['role']
        assigned_location_id: string | null
        token: string
        expires_at: string
      }

      const inviteUrl = `${window.location.origin}/invite/${saved.token}`
      const { error: emailSendError } = await deliverInviteEmail({
        email: saved.email,
        orgName: orgName || organisation?.name || 'your organization',
        role: saved.role,
        token: saved.token,
        inviteUrl,
      })

      setInvites((current) => [
        ...current,
        {
          id: saved.id,
          email: saved.email,
          role: saved.role,
          assignedLocationId: saved.assigned_location_id,
          token: saved.token,
          expiresAt: saved.expires_at,
          emailSent: !emailSendError,
        },
      ])
      setSaving(false)

      if (emailSendError) {
        const message = `Invite created, but the email could not be sent: ${emailSendError} Copy the link from Pending invites below.`
        return { error: message, inviteId: saved.id, emailSent: false }
      }

      return { error: null, inviteId: saved.id, emailSent: true }
    },
    [canManage, orgName, organisation?.name]
  )

  const revokeInvite = useCallback(
    async (id: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to revoke invites.' }
      }
      setSaving(true)
      const { error: deleteError } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id)
      setSaving(false)
      if (deleteError) {
        setError(deleteError.message)
        return { error: deleteError.message }
      }
      setInvites((current) => current.filter((item) => item.id !== id))
      return { error: null }
    },
    [canManage]
  )

  const updateMemberRole = useCallback(
    async (input: {
      memberId: string
      role: Exclude<OrgRole, 'owner'>
      assignedLocationId: string | null
    }) => {
      if (!canManage) {
        return { error: 'You do not have permission to change member roles.' }
      }
      if (input.role === 'location_viewer' && !input.assignedLocationId) {
        return { error: 'Assign a location for Location Viewer.' }
      }

      setSaving(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('update_member_role', {
        p_member_id: input.memberId,
        p_role: input.role,
        p_assigned_location_id: input.assignedLocationId,
      })
      setSaving(false)

      if (rpcError || !data) {
        const message = rpcError?.message ?? 'Could not update member role.'
        setError(message)
        return { error: message }
      }

      const row = data as {
        id: string
        role: TeamMember['role']
        assigned_location_id: string | null
      }
      setMembers((current) =>
        current.map((member) =>
          member.id === row.id
            ? {
                ...member,
                role: row.role,
                assignedLocationId: row.assigned_location_id,
              }
            : member
        )
      )
      return { error: null }
    },
    [canManage]
  )

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to remove members.' }
      }

      setSaving(true)
      setError(null)
      const { error: rpcError } = await supabase.rpc('remove_org_member', {
        p_member_id: memberId,
      })
      setSaving(false)

      if (rpcError) {
        setError(rpcError.message)
        return { error: rpcError.message }
      }

      setMembers((current) => current.filter((member) => member.id !== memberId))
      return { error: null }
    },
    [canManage]
  )

  const suspendMember = useCallback(
    async (memberId: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to suspend members.' }
      }

      setSaving(true)
      setError(null)
      const { error: rpcError } = await supabase.rpc('suspend_user', {
        p_user_id: memberId,
      })
      setSaving(false)

      if (rpcError) {
        setError(rpcError.message)
        return { error: rpcError.message }
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === memberId
            ? { ...member, suspendedAt: new Date().toISOString() }
            : member
        )
      )
      return { error: null }
    },
    [canManage]
  )

  const unsuspendMember = useCallback(
    async (memberId: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to unsuspend members.' }
      }

      setSaving(true)
      setError(null)
      const { error: rpcError } = await supabase.rpc('unsuspend_user', {
        p_user_id: memberId,
      })
      setSaving(false)

      if (rpcError) {
        setError(rpcError.message)
        return { error: rpcError.message }
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? { ...member, suspendedAt: null } : member
        )
      )
      return { error: null }
    },
    [canManage]
  )

  return {
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
    email: profile?.email ?? '',
    role: profile?.role ?? null,
    members,
    invites,
    locations,
    planLabel,
    billingStatus,
    orgDirty:
      orgName.trim() !== orgBaseline.name.trim() ||
      (industry || '') !== (orgBaseline.industry || ''),
    profileDirty: fullName.trim() !== profileBaseline.trim(),
    saveOrganisation,
    saveProfile,
    createInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
    suspendMember,
    unsuspendMember,
    refresh,
  }
}
