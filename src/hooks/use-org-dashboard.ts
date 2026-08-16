import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { mergeById, pageRange } from '@/lib/pagination'
import { supabase } from '@/lib/supabase/client'
import type { CallStatus } from '@/types/org'

export interface LocationCallStats {
  lastCallAt: string | null
  lastScore: number | null
  lastStatus: CallStatus | null
}

export interface DashboardLocation {
  id: string
  name: string
  phone: string | null
  timezone: string | null
  country: string | null
  callFrequency: string | null
  stats: LocationCallStats
}

export interface TrendPoint {
  label: string
  score: number
}

export type TrendPeriod = 'weekly' | 'monthly' | 'yearly'

export interface OrgDashboardData {
  locations: DashboardLocation[]
  locationCount: number
  criteriaCount: number
  totalCriteriaCount: number
  scorecardCount: number
  agentCount: number
  approvedAgentCount: number
  scenarioApproved: boolean
  pendingInvites: number
  teamMembers: number
  networkAverage: number | null
  weeklyTrend: TrendPoint[]
  monthlyTrend: TrendPoint[]
  yearlyTrend: TrendPoint[]
  awaitingReviewCount: number
  totalCalls: number
}

interface OrgDashboardState {
  loading: boolean
  loadingMore: boolean
  error: string | null
  data: OrgDashboardData | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

const emptyData: OrgDashboardData = {
  locations: [],
  locationCount: 0,
  criteriaCount: 0,
  totalCriteriaCount: 0,
  scorecardCount: 0,
  agentCount: 0,
  approvedAgentCount: 0,
  scenarioApproved: false,
  pendingInvites: 0,
  teamMembers: 0,
  networkAverage: null,
  weeklyTrend: [],
  monthlyTrend: [],
  yearlyTrend: [],
  awaitingReviewCount: 0,
  totalCalls: 0,
}

function weekLabel(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  const month = start.toLocaleString('en-GB', { month: 'short' })
  const day = start.getDate()
  return `${month} ${day}`
}

function monthLabel(date: Date) {
  return date.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

function yearLabel(date: Date) {
  return String(date.getFullYear())
}

type ScoredCallInput = {
  score: number | null
  completedAt: string | null
  createdAt: string
}

function bucketKey(date: Date, period: TrendPeriod) {
  if (period === 'weekly') return weekLabel(date)
  if (period === 'monthly') return monthLabel(date)
  return yearLabel(date)
}

function padLabel(period: TrendPeriod, index: number) {
  if (period === 'weekly') return `W${String(index + 1).padStart(2, '0')}`
  if (period === 'monthly') return `M${String(index + 1).padStart(2, '0')}`
  return `Y${index + 1}`
}

function buildTrend(calls: ScoredCallInput[], period: TrendPeriod) {
  const scoredCalls = calls.filter(
    (call) => call.score != null && (call.completedAt || call.createdAt)
  )

  const buckets = new Map<string, number[]>()
  for (const call of scoredCalls) {
    const when = new Date(call.completedAt ?? call.createdAt)
    const key = bucketKey(when, period)
    const bucket = buckets.get(key) ?? []
    bucket.push(call.score as number)
    buckets.set(key, bucket)
  }

  const points = Array.from(buckets.entries()).map(([label, scores]) => ({
    label,
    score:
      Math.round(
        (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10
      ) / 10,
  }))

  const maxPoints = period === 'yearly' ? 5 : 12
  if (points.length >= maxPoints) {
    return points.slice(-maxPoints)
  }

  const padded: TrendPoint[] = []
  for (let index = 0; index < maxPoints - points.length; index += 1) {
    padded.push({ label: padLabel(period, index), score: 0 })
  }

  return [...padded, ...points]
}

export function useOrgDashboard(): OrgDashboardState {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const [loading, setLoading] = useState(Boolean(orgId))
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OrgDashboardData | null>(null)
  const locationsRef = useRef<DashboardLocation[]>([])
  const locationCountRef = useRef(0)
  const statsRef = useRef<Map<string, LocationCallStats>>(new Map())
  const loadingMoreRef = useRef(false)
  locationsRef.current = data?.locations ?? []
  locationCountRef.current = data?.locationCount ?? 0

  const mapLocations = useCallback(
    (rows: Record<string, unknown>[]) =>
      rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        phone: (row.phone as string | null) ?? null,
        timezone: (row.timezone as string | null) ?? null,
        country: (row.country as string | null) ?? null,
        callFrequency: (row.call_frequency as string | null) ?? null,
        stats: statsRef.current.get(row.id as string) ?? {
          lastCallAt: null,
          lastScore: null,
          lastStatus: null,
        },
      })),
    []
  )

  const fetchLocationRows = useCallback(
    async (fromLoaded: number, withCount: boolean) => {
      if (!orgId) {
        return { rows: [] as DashboardLocation[], count: 0, error: null as string | null }
      }

      const { from, to } = pageRange(fromLoaded)
      let query = supabase
        .from('locations')
        .select(
          'id, name, phone, timezone, country, call_frequency',
          { count: withCount ? 'exact' : undefined }
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
        query = query.eq('id', profile.assignedLocationId)
      }

      const { data: rows, error: queryError, count } = await query
      if (queryError) {
        return { rows: [] as DashboardLocation[], count: 0, error: queryError.message }
      }

      return {
        rows: mapLocations((rows ?? []) as Record<string, unknown>[]),
        count: typeof count === 'number' ? count : 0,
        error: null as string | null,
      }
    },
    [mapLocations, orgId, profile?.assignedLocationId, profile?.role]
  )

  const refresh = useCallback(async () => {
    if (!orgId) {
      setData(emptyData)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let callsQuery = supabase
      .from('calls')
      .select('location_id, status, score, completed_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1000)
    let totalCallsQuery = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
    let awaitingQuery = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'awaiting_review')

    if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
      callsQuery = callsQuery.eq('location_id', profile.assignedLocationId)
      totalCallsQuery = totalCallsQuery.eq(
        'location_id',
        profile.assignedLocationId
      )
      awaitingQuery = awaitingQuery.eq(
        'location_id',
        profile.assignedLocationId
      )
    }

    const [
      scorecardsRes,
      scenariosRes,
      invitesRes,
      membersRes,
      callsRes,
      totalCallsRes,
      awaitingRes,
    ] = await Promise.all([
      supabase
        .from('scorecards')
        .select('criteria, is_default')
        .eq('org_id', orgId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('scenarios').select('approved_at').eq('org_id', orgId),
      supabase
        .from('invitations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('accepted_at', null),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      callsQuery,
      totalCallsQuery,
      awaitingQuery,
    ])

    const firstError =
      scorecardsRes.error?.message ||
      scenariosRes.error?.message ||
      invitesRes.error?.message ||
      membersRes.error?.message ||
      callsRes.error?.message ||
      totalCallsRes.error?.message ||
      awaitingRes.error?.message ||
      null

    if (firstError) {
      setError(firstError)
      setData(emptyData)
      setLoading(false)
      return
    }

    const calls = callsRes.data ?? []
    const statsByLocation = new Map<string, LocationCallStats>()
    for (const call of calls) {
      const locationId = call.location_id as string
      if (statsByLocation.has(locationId)) continue
      statsByLocation.set(locationId, {
        lastCallAt:
          (call.completed_at as string | null) ??
          (call.created_at as string | null),
        lastScore: call.score == null ? null : Number(call.score),
        lastStatus: call.status as CallStatus,
      })
    }
    statsRef.current = statsByLocation

    const scoredCalls = calls.filter((call) => call.score != null)
    const networkAverage =
      scoredCalls.length > 0
        ? Math.round(
            (scoredCalls.reduce((sum, call) => sum + Number(call.score), 0) /
              scoredCalls.length) *
              10
          ) / 10
        : null

    const scorecardRows = scorecardsRes.data ?? []
    const scenarioRows = scenariosRes.data ?? []
    const defaultScorecard =
      scorecardRows.find((row) => row.is_default) ?? scorecardRows[0]
    const defaultCriteria = Array.isArray(defaultScorecard?.criteria)
      ? defaultScorecard.criteria
      : []
    const totalCriteriaCount = scorecardRows.reduce((sum, row) => {
      const count = Array.isArray(row.criteria) ? row.criteria.length : 0
      return sum + count
    }, 0)
    const approvedAgentCount = scenarioRows.filter(
      (row) => row.approved_at
    ).length

    const trendCalls = calls.map((call) => ({
      score: call.score == null ? null : Number(call.score),
      completedAt: (call.completed_at as string | null) ?? null,
      createdAt: call.created_at as string,
    }))

    const locationsPage = await fetchLocationRows(0, true)
    if (locationsPage.error) {
      setError(locationsPage.error)
      setData(emptyData)
      setLoading(false)
      return
    }

    setData({
      ...emptyData,
      locations: locationsPage.rows,
      locationCount: locationsPage.count || locationsPage.rows.length,
      criteriaCount: defaultCriteria.length,
      totalCriteriaCount,
      scorecardCount: scorecardRows.length,
      agentCount: scenarioRows.length,
      approvedAgentCount,
      scenarioApproved: approvedAgentCount > 0,
      pendingInvites: invitesRes.count ?? 0,
      teamMembers: membersRes.count ?? 0,
      networkAverage,
      weeklyTrend: buildTrend(trendCalls, 'weekly'),
      monthlyTrend: buildTrend(trendCalls, 'monthly'),
      yearlyTrend: buildTrend(trendCalls, 'yearly'),
      awaitingReviewCount: awaitingRes.count ?? 0,
      totalCalls: totalCallsRes.count ?? 0,
    })
    setLoading(false)
  }, [fetchLocationRows, orgId, profile?.assignedLocationId, profile?.role])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    if (
      locationCountRef.current > 0 &&
      locationsRef.current.length >= locationCountRef.current
    ) {
      return
    }

    loadingMoreRef.current = true
    setLoadingMore(true)
    const page = await fetchLocationRows(locationsRef.current.length, false)
    if (page.error) setError(page.error)
    else {
      setData((current) => {
        if (!current) return current
        return {
          ...current,
          locations: mergeById(current.locations, page.rows, false),
        }
      })
    }
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [fetchLocationRows])

  return {
    loading,
    loadingMore,
    error,
    data,
    hasMore: (data?.locations.length ?? 0) < (data?.locationCount ?? 0),
    loadMore,
    refresh,
  }
}
