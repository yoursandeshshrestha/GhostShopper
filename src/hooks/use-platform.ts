import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { invokeFunction } from '@/lib/invoke-function'
import { mergeById, nestedCount, pageRange } from '@/lib/pagination'
import type { CallStatus } from '@/types/org'

export interface PlatformOrg {
  id: string
  name: string
  industry: string | null
  setupCompleted: boolean
  attested: boolean
  createdAt: string
  memberCount: number
  locationCount: number
  callCount: number
}

export interface PlatformUser {
  id: string
  email: string
  fullName: string | null
  role: string
  orgId: string | null
  orgName: string | null
  createdAt: string
}

export interface PlatformCall {
  id: string
  orgId: string
  orgName: string
  locationName: string
  status: CallStatus
  score: number | null
  flaggedForReview: boolean
  createdAt: string
}

export interface PlatformInvite {
  id: string
  email: string
  token: string
  expiresAt: string
  emailSent: boolean
}

export interface PlatformOverview {
  orgCount: number
  userCount: number
  locationCount: number
  callCount: number
  awaitingReviewCount: number
  flaggedCount: number
}

const ORG_LIST_SELECT =
  'id, name, industry, setup_completed, attestation_signed_at, created_at, profiles(count), locations(count), calls(count)'

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return (Array.isArray(value) ? value[0] : value) as Record<
    string,
    unknown
  > | null
}

function mapOrg(row: Record<string, unknown>): PlatformOrg {
  return {
    id: row.id as string,
    name: (row.name as string) || 'Untitled',
    industry: (row.industry as string | null) ?? null,
    setupCompleted: Boolean(row.setup_completed),
    attested: Boolean(row.attestation_signed_at),
    createdAt: row.created_at as string,
    memberCount: nestedCount(row.profiles),
    locationCount: nestedCount(row.locations),
    callCount: nestedCount(row.calls),
  }
}

function mapUser(row: Record<string, unknown>): PlatformUser {
  const org = asRecord(row.orgs)
  const orgId = (row.org_id as string | null) ?? null
  return {
    id: row.id as string,
    email: row.email as string,
    fullName: (row.full_name as string | null) ?? null,
    role: row.role as string,
    orgId,
    orgName: orgId
      ? ((org?.name as string | undefined) ?? 'Unknown org')
      : 'Platform',
    createdAt: row.created_at as string,
  }
}

function mapCall(row: Record<string, unknown>): PlatformCall {
  const location = asRecord(row.locations)
  const org = asRecord(row.orgs)
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    orgName: (org?.name as string | undefined) || 'Unknown org',
    locationName: (location?.name as string | undefined) || 'Unknown location',
    status: row.status as CallStatus,
    score: (row.score as number | null) ?? null,
    flaggedForReview: Boolean(row.flagged_for_review),
    createdAt: row.created_at as string,
  }
}

export function usePlatformOverview() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<PlatformOrg[]>([])
  const [overview, setOverview] = useState<PlatformOverview>({
    orgCount: 0,
    userCount: 0,
    locationCount: 0,
    callCount: 0,
    awaitingReviewCount: 0,
    flaggedCount: 0,
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [
      orgCountRes,
      userCountRes,
      locationCountRes,
      callCountRes,
      awaitingRes,
      flaggedRes,
      recentOrgsRes,
    ] = await Promise.all([
      supabase.from('orgs').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .neq('role', 'superadmin'),
      supabase.from('locations').select('id', { count: 'exact', head: true }),
      supabase.from('calls').select('id', { count: 'exact', head: true }),
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting_review'),
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('flagged_for_review', true),
      supabase
        .from('orgs')
        .select(ORG_LIST_SELECT)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    const firstError =
      orgCountRes.error?.message ||
      userCountRes.error?.message ||
      locationCountRes.error?.message ||
      callCountRes.error?.message ||
      awaitingRes.error?.message ||
      flaggedRes.error?.message ||
      recentOrgsRes.error?.message ||
      null

    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    setOverview({
      orgCount: orgCountRes.count ?? 0,
      userCount: userCountRes.count ?? 0,
      locationCount: locationCountRes.count ?? 0,
      callCount: callCountRes.count ?? 0,
      awaitingReviewCount: awaitingRes.count ?? 0,
      flaggedCount: flaggedRes.count ?? 0,
    })
    setOrgs((recentOrgsRes.data ?? []).map((row) => mapOrg(row as Record<string, unknown>)))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loading, error, orgs, overview, refresh }
}

export function usePlatformOrgs() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<PlatformOrg[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const itemsRef = useRef<PlatformOrg[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  itemsRef.current = orgs
  totalCountRef.current = totalCount

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!reset && loadingMoreRef.current) return
    if (
      !reset &&
      totalCountRef.current > 0 &&
      itemsRef.current.length >= totalCountRef.current
    ) {
      return
    }

    if (reset) {
      setLoading(true)
      setError(null)
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }

    const { from, to } = pageRange(reset ? 0 : itemsRef.current.length)
    const { data, error: queryError, count } = await supabase
      .from('orgs')
      .select(ORG_LIST_SELECT, { count: reset ? 'exact' : undefined })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
      return
    }

    const rows = (data ?? []).map((row) => mapOrg(row as Record<string, unknown>))
    setOrgs((current) => mergeById(current, rows, reset))
    if (typeof count === 'number') setTotalCount(count)
    else if (reset) setTotalCount(rows.length)

    setLoading(false)
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [])

  useEffect(() => {
    void fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  return {
    loading,
    loadingMore,
    error,
    orgs,
    totalCount,
    hasMore: orgs.length < totalCount,
    loadMore,
  }
}

export function usePlatformUsers() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [invites, setInvites] = useState<PlatformInvite[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const itemsRef = useRef<PlatformUser[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  itemsRef.current = users
  totalCountRef.current = totalCount

  const fetchInvites = useCallback(async () => {
    const { data, error: invitesError } = await supabase
      .from('platform_invitations')
      .select('id, email, token, expires_at')
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
    if (invitesError) return invitesError.message
    setInvites(
      (data ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        token: row.token as string,
        expiresAt: row.expires_at as string,
        emailSent: true,
      }))
    )
    return null
  }, [])

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!reset && loadingMoreRef.current) return
      if (
        !reset &&
        totalCountRef.current > 0 &&
        itemsRef.current.length >= totalCountRef.current
      ) {
        return
      }

      if (reset) {
        setLoading(true)
        setError(null)
      } else {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const { from, to } = pageRange(reset ? 0 : itemsRef.current.length)
      const [usersRes, invitesError] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, email, full_name, role, org_id, created_at, orgs(name)',
            { count: reset ? 'exact' : undefined }
          )
          .order('created_at', { ascending: false })
          .range(from, to),
        reset ? fetchInvites() : Promise.resolve(null),
      ])

      const firstError = usersRes.error?.message || invitesError || null
      if (firstError) {
        setError(firstError)
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
        return
      }

      const rows = (usersRes.data ?? []).map((row) =>
        mapUser(row as Record<string, unknown>)
      )
      setUsers((current) => mergeById(current, rows, reset))
      if (typeof usersRes.count === 'number') setTotalCount(usersRes.count)
      else if (reset) setTotalCount(rows.length)

      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    },
    [fetchInvites]
  )

  useEffect(() => {
    void fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  const inviteSuperadmin = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return { error: 'Email is required.' }

    setSaving(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc(
      'create_platform_invitation',
      { invite_email: trimmed }
    )

    if (rpcError || !data) {
      const message = rpcError?.message ?? 'Could not create invite.'
      setSaving(false)
      setError(message)
      return { error: message }
    }

    const saved = data as {
      id: string
      email: string
      token: string
      expires_at: string
    }
    const inviteUrl = `${window.location.origin}/invite/${saved.token}`
    const { error: emailSendError } = await invokeFunction(
      'send-invite-email',
      {
        email: saved.email,
        orgName: 'GhostShopper',
        role: 'superadmin',
        token: saved.token,
        inviteUrl,
      }
    )

    setInvites((current) => [
      {
        id: saved.id,
        email: saved.email,
        token: saved.token,
        expiresAt: saved.expires_at,
        emailSent: !emailSendError,
      },
      ...current,
    ])
    setSaving(false)

    if (emailSendError) {
      return {
        error: `Invite created, but the email could not be sent: ${emailSendError} Copy the link below.`,
        token: saved.token,
      }
    }

    return { error: null, token: saved.token }
  }, [])

  const revokeSuperadminInvite = useCallback(async (id: string) => {
    setSaving(true)
    const { error: deleteError } = await supabase
      .from('platform_invitations')
      .delete()
      .eq('id', id)
    setSaving(false)
    if (deleteError) {
      setError(deleteError.message)
      return { error: deleteError.message }
    }
    setInvites((current) => current.filter((item) => item.id !== id))
    return { error: null }
  }, [])

  return {
    loading,
    loadingMore,
    saving,
    error,
    users,
    invites,
    totalCount,
    hasMore: users.length < totalCount,
    loadMore,
    inviteSuperadmin,
    revokeSuperadminInvite,
  }
}

export function usePlatformCalls() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calls, setCalls] = useState<PlatformCall[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const itemsRef = useRef<PlatformCall[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  itemsRef.current = calls
  totalCountRef.current = totalCount

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!reset && loadingMoreRef.current) return
    if (
      !reset &&
      totalCountRef.current > 0 &&
      itemsRef.current.length >= totalCountRef.current
    ) {
      return
    }

    if (reset) {
      setLoading(true)
      setError(null)
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }

    const { from, to } = pageRange(reset ? 0 : itemsRef.current.length)
    const { data, error: queryError, count } = await supabase
      .from('calls')
      .select(
        'id, org_id, status, score, flagged_for_review, created_at, locations(name), orgs(name)',
        { count: reset ? 'exact' : undefined }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
      return
    }

    const rows = (data ?? []).map((row) => mapCall(row as Record<string, unknown>))
    setCalls((current) => mergeById(current, rows, reset))
    if (typeof count === 'number') setTotalCount(count)
    else if (reset) setTotalCount(rows.length)

    setLoading(false)
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [])

  useEffect(() => {
    void fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  return {
    loading,
    loadingMore,
    error,
    calls,
    totalCount,
    hasMore: calls.length < totalCount,
    loadMore,
  }
}

export function usePlatformOrgDetail(id: string | undefined) {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<PlatformOrg | null>(null)
  const [members, setMembers] = useState<PlatformUser[]>([])
  const [calls, setCalls] = useState<PlatformCall[]>([])
  const [totalCallCount, setTotalCallCount] = useState(0)
  const itemsRef = useRef<PlatformCall[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  itemsRef.current = calls
  totalCountRef.current = totalCallCount

  const fetchCallsPage = useCallback(
    async (reset: boolean, orgId: string) => {
      if (!reset && loadingMoreRef.current) return
      if (
        !reset &&
        totalCountRef.current > 0 &&
        itemsRef.current.length >= totalCountRef.current
      ) {
        return
      }

      if (!reset) {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const { from, to } = pageRange(reset ? 0 : itemsRef.current.length)
      const { data, error: queryError, count } = await supabase
        .from('calls')
        .select(
          'id, org_id, status, score, flagged_for_review, created_at, locations(name), orgs(name)',
          { count: reset ? 'exact' : undefined }
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (queryError) {
        setError(queryError.message)
        setLoadingMore(false)
        loadingMoreRef.current = false
        return
      }

      const rows = (data ?? []).map((row) =>
        mapCall(row as Record<string, unknown>)
      )
      setCalls((current) => mergeById(current, rows, reset))
      if (typeof count === 'number') setTotalCallCount(count)
      else if (reset) setTotalCallCount(rows.length)

      setLoadingMore(false)
      loadingMoreRef.current = false
    },
    []
  )

  const refresh = useCallback(async () => {
    if (!id) {
      setOrg(null)
      setMembers([])
      setCalls([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [orgRes, membersRes] = await Promise.all([
      supabase.from('orgs').select(ORG_LIST_SELECT).eq('id', id).maybeSingle(),
      supabase
        .from('profiles')
        .select('id, email, full_name, role, org_id, created_at, orgs(name)')
        .eq('org_id', id)
        .order('created_at', { ascending: true }),
    ])

    const firstError = orgRes.error?.message || membersRes.error?.message || null
    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    setOrg(orgRes.data ? mapOrg(orgRes.data as Record<string, unknown>) : null)
    setMembers(
      (membersRes.data ?? []).map((row) => mapUser(row as Record<string, unknown>))
    )
    await fetchCallsPage(true, id)
    setLoading(false)
  }, [fetchCallsPage, id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!id) return
    await fetchCallsPage(false, id)
  }, [fetchCallsPage, id])

  return {
    loading,
    loadingMore,
    error,
    org,
    members,
    calls,
    totalCallCount,
    hasMore: calls.length < totalCallCount,
    loadMore,
  }
}
