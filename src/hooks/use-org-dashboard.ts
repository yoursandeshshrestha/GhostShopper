import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
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
  error: string | null
  data: OrgDashboardData | null
  refresh: () => Promise<void>
}

const emptyData: OrgDashboardData = {
  locations: [],
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
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OrgDashboardData | null>(null)

  const refresh = useCallback(async () => {
    if (!orgId) {
      setData(emptyData)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [locationsRes, scorecardsRes, scenariosRes, invitesRes, membersRes, callsRes] =
      await Promise.all([
        supabase
          .from('locations')
          .select('id, name, phone, timezone, country, call_frequency')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('scorecards')
          .select('criteria, is_default')
          .eq('org_id', orgId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('scenarios')
          .select('approved_at')
          .eq('org_id', orgId),
        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .is('accepted_at', null),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('calls')
          .select('location_id, status, score, completed_at, created_at')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),
      ])

    const firstError =
      locationsRes.error?.message ||
      scorecardsRes.error?.message ||
      scenariosRes.error?.message ||
      invitesRes.error?.message ||
      membersRes.error?.message ||
      callsRes.error?.message ||
      null

    if (firstError) {
      setError(firstError)
      setData(emptyData)
      setLoading(false)
      return
    }

    let locationRows = locationsRes.data ?? []
    if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
      locationRows = locationRows.filter(
        (row) => row.id === profile.assignedLocationId
      )
    }

    let calls = callsRes.data ?? []
    if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
      calls = calls.filter(
        (call) => call.location_id === profile.assignedLocationId
      )
    }

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

    const locations: DashboardLocation[] = locationRows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      phone: (row.phone as string | null) ?? null,
      timezone: (row.timezone as string | null) ?? null,
      country: (row.country as string | null) ?? null,
      callFrequency: (row.call_frequency as string | null) ?? null,
      stats: statsByLocation.get(row.id as string) ?? {
        lastCallAt: null,
        lastScore: null,
        lastStatus: null,
      },
    }))

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

    setData({
      locations,
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
      awaitingReviewCount: calls.filter(
        (call) => call.status === 'awaiting_review'
      ).length,
      totalCalls: calls.length,
    })
    setLoading(false)
  }, [orgId, profile?.assignedLocationId, profile?.role])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loading, error, data, refresh }
}
