import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { invokeFunction } from '@/lib/invoke-function'
import {
  CALLS_LIST_SELECT,
  mapCall,
  mapCriteria,
  sortCallsByCreatedAt,
  type OrgAgentOption,
  type OrgScorecardOption,
} from '@/lib/calls'
import { LIST_PAGE_SIZE, mergeById, pageRange } from '@/lib/pagination'
import { supabase } from '@/lib/supabase/client'
import { canReviewCalls, canStartCalls } from '@/lib/permissions'
import {
  computeWeightedScore,
  type CallCriterionScore,
  type CallStatus,
  type OrgCall,
} from '@/types/org'
import type { ScorecardCriterion } from '@/types/setup'

export interface CreateCallInput {
  locationId: string
  scenarioId: string
  scorecardId: string
}

function mapAgents(rows: Record<string, unknown>[]): OrgAgentOption[] {
  return rows.map((row) => ({
    id: row.id as string,
    name: (row.name as string) || 'Untitled agent',
    approved: Boolean(row.approved_at),
    isDefault: Boolean(row.is_default),
  }))
}

function mapScorecards(rows: Record<string, unknown>[]): OrgScorecardOption[] {
  return rows.map((row) => ({
    id: row.id as string,
    name: (row.name as string) || 'Default Scorecard',
    isDefault: Boolean(row.is_default),
    criteria: mapCriteria(row.criteria),
  }))
}

export function useCalls() {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canCreate = canStartCalls(profile?.role)
  const canReview = canReviewCalls(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [loadingMore, setLoadingMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calls, setCalls] = useState<OrgCall[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [locations, setLocations] = useState<
    { id: string; name: string; timezone: string | null }[]
  >([])
  const [agents, setAgents] = useState<OrgAgentOption[]>([])
  const [scorecards, setScorecards] = useState<OrgScorecardOption[]>([])
  const callsRef = useRef<OrgCall[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  callsRef.current = calls
  totalCountRef.current = totalCount

  const canSeeCall = useCallback(
    (call: OrgCall) => {
      if (
        profile?.role === 'location_viewer' &&
        profile.assignedLocationId &&
        call.locationId !== profile.assignedLocationId
      ) {
        return false
      }
      return true
    },
    [profile?.assignedLocationId, profile?.role]
  )

  const upsertCall = useCallback(
    (call: OrgCall) => {
      if (!canSeeCall(call)) return
      setCalls((current) => {
        const index = current.findIndex((row) => row.id === call.id)
        if (index === -1) {
          setTotalCount((count) => count + 1)
          return sortCallsByCreatedAt([call, ...current])
        }
        const next = [...current]
        next[index] = call
        return next
      })
    },
    [canSeeCall]
  )

  const removeCall = useCallback((callId: string) => {
    setCalls((current) => {
      if (!current.some((call) => call.id === callId)) return current
      setTotalCount((count) => Math.max(0, count - 1))
      return current.filter((call) => call.id !== callId)
    })
  }, [])

  const fetchCallById = useCallback(
    async (callId: string) => {
      const { data, error: fetchError } = await supabase
        .from('calls')
        .select(CALLS_LIST_SELECT)
        .eq('id', callId)
        .maybeSingle()

      if (fetchError || !data) return
      upsertCall(mapCall(data as Record<string, unknown>))
    },
    [upsertCall]
  )

  const fetchCallsPage = useCallback(
    async (options?: {
      reset?: boolean
      silent?: boolean
      sync?: boolean
    }) => {
      if (!orgId) {
        setCalls([])
        setTotalCount(0)
        setLocations([])
        setAgents([])
        setScorecards([])
        setLoading(false)
        return
      }

      const reset = options?.reset ?? false
      const silent = options?.silent ?? false
      const sync = options?.sync ?? false

      if (!reset && loadingMoreRef.current) return
      if (
        !reset &&
        totalCountRef.current > 0 &&
        callsRef.current.length >= totalCountRef.current
      ) {
        return
      }

      if (reset && (sync || silent)) {
        setSyncing(true)
      } else if (reset && !silent) {
        setLoading(true)
        setError(null)
      } else if (!reset) {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      if (sync) {
        await invokeFunction('sync-call-status', {})
      }

      const take = reset
        ? Math.max(LIST_PAGE_SIZE, silent ? callsRef.current.length : LIST_PAGE_SIZE)
        : LIST_PAGE_SIZE
      const { from, to } = pageRange(reset ? 0 : callsRef.current.length, take)

      let callsQuery = supabase
        .from('calls')
        .select(CALLS_LIST_SELECT, { count: reset ? 'exact' : undefined })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
        callsQuery = callsQuery.eq('location_id', profile.assignedLocationId)
      }

      const [callsRes, locationsRes, agentsRes, scorecardsRes] =
        await Promise.all([
          callsQuery,
          silent || !reset
            ? Promise.resolve({ data: null, error: null })
            : supabase
                .from('locations')
                .select('id, name, timezone')
                .eq('org_id', orgId)
                .order('name', { ascending: true }),
          silent || !reset
            ? Promise.resolve({ data: null, error: null })
            : supabase
                .from('scenarios')
                .select('id, name, approved_at, is_default')
                .eq('org_id', orgId)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true }),
          silent || !reset
            ? Promise.resolve({ data: null, error: null })
            : supabase
                .from('scorecards')
                .select('id, name, is_default, criteria')
                .eq('org_id', orgId)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true }),
        ])

      const firstError =
        callsRes.error?.message ||
        (reset && !silent && locationsRes.error?.message) ||
        (reset && !silent && agentsRes.error?.message) ||
        (reset && !silent && scorecardsRes.error?.message) ||
        null

      if (firstError) {
        if (!silent) setError(firstError)
        setSyncing(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
        if (reset && !silent && !sync) setLoading(false)
        return
      }

      const nextCalls = (callsRes.data ?? []).map((row) =>
        mapCall(row as Record<string, unknown>)
      )

      setCalls((current) => mergeById(current, nextCalls, reset))
      if (typeof callsRes.count === 'number') {
        setTotalCount(callsRes.count)
      } else if (reset) {
        setTotalCount(nextCalls.length)
      }

      if (reset && !silent) {
        setLocations(
          (locationsRes.data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            timezone: (row.timezone as string | null) ?? null,
          }))
        )
        setAgents(mapAgents((agentsRes.data ?? []) as Record<string, unknown>[]))
        setScorecards(
          mapScorecards((scorecardsRes.data ?? []) as Record<string, unknown>[])
        )
      }

      setSyncing(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
      if (reset && !silent) setLoading(false)
    },
    [orgId, profile?.assignedLocationId, profile?.role]
  )

  const refresh = useCallback(
    async (options?: { silent?: boolean; sync?: boolean }) => {
      await fetchCallsPage({
        reset: true,
        silent: options?.silent,
        sync: options?.sync,
      })
    },
    [fetchCallsPage]
  )

  const loadMore = useCallback(async () => {
    await fetchCallsPage({ reset: false })
  }, [fetchCallsPage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`calls:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId) removeCall(deletedId)
            return
          }

          const callId = (payload.new as { id?: string }).id
          if (callId) void fetchCallById(callId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchCallById, orgId, removeCall])

  const getCriteriaForCall = useCallback(
    (call: OrgCall | null): ScorecardCriterion[] => {
      if (!call?.scorecardId) {
        const fallback =
          scorecards.find((item) => item.isDefault) ?? scorecards[0]
        return fallback?.criteria ?? []
      }
      return (
        scorecards.find((item) => item.id === call.scorecardId)?.criteria ?? []
      )
    },
    [scorecards]
  )

  const createCall = useCallback(
    async (input: CreateCallInput) => {
      if (!orgId || !canCreate) {
        return { error: 'You do not have permission to start calls.' }
      }
      if (!input.locationId) return { error: 'Choose a location.' }
      if (!input.scenarioId) return { error: 'Choose an agent.' }
      if (!input.scorecardId) return { error: 'Choose a scorecard.' }

      setSaving(true)
      setError(null)

      const { data: payload, error: invokeError } = await invokeFunction<{
        error?: string
        call?: Record<string, unknown>
        mode?: 'simulation' | 'live'
      }>('start-call', {
        locationId: input.locationId,
        scenarioId: input.scenarioId,
        scorecardId: input.scorecardId,
      })

      setSaving(false)

      if (invokeError) {
        setError(invokeError)
        return { error: invokeError }
      }

      if (!payload?.call) {
        const message = 'Could not create call.'
        setError(message)
        return { error: message }
      }

      const created = mapCall(payload.call)
      upsertCall(created)
      return { error: null, call: created, mode: payload.mode ?? 'simulation' }
    },
    [canCreate, orgId, upsertCall]
  )

  const updateCallReview = useCallback(
    async (
      id: string,
      input: {
        criterionScores: CallCriterionScore[]
        notes?: string
        coachingSummary?: string | null
        status?: CallStatus
      }
    ) => {
      if (!canReview) {
        return { error: 'You do not have permission to review calls.' }
      }

      const score = computeWeightedScore(input.criterionScores)
      if (score == null) {
        return { error: 'Add at least one criterion score.' }
      }

      setSaving(true)
      setError(null)

      const criterionScores = input.criterionScores.map((item) => ({
        ...item,
        source: item.source ?? 'human',
      }))

      const coachingSummary = input.coachingSummary ?? input.notes ?? null

      const { data, error: updateError } = await supabase
        .from('calls')
        .update({
          score,
          criterion_scores: criterionScores,
          notes: input.notes ?? null,
          coaching_summary: coachingSummary,
          status: input.status ?? 'completed',
          completed_at: new Date().toISOString(),
          human_reviewed: true,
          flagged_for_review: false,
        })
        .eq('id', id)
        .select(CALLS_LIST_SELECT)
        .single()

      if (updateError || !data) {
        setSaving(false)
        const message = updateError?.message ?? 'Could not update call.'
        setError(message)
        return { error: message }
      }

      const { error: scoreError } = await supabase.rpc('upsert_call_score', {
        p_call_id: id,
        p_criterion_scores: criterionScores,
        p_total: score,
        p_human_reviewed: true,
        p_flagged_for_review: false,
        p_coaching_summary: coachingSummary,
      })

      setSaving(false)

      if (scoreError) {
        const message = scoreError.message
        setError(message)
        return { error: message }
      }

      const updated = mapCall(data as Record<string, unknown>)
      upsertCall(updated)
      return { error: null, call: updated }
    },
    [canReview, upsertCall]
  )

  const awaitingReviewCount = calls.filter(
    (call) => call.status === 'awaiting_review'
  ).length
  const hasMore = calls.length < totalCount

  const defaultAgent =
    agents.find((agent) => agent.isDefault) ?? agents[0] ?? null
  const defaultScorecard =
    scorecards.find((scorecard) => scorecard.isDefault) ?? scorecards[0] ?? null

  return {
    loading,
    loadingMore,
    syncing,
    saving,
    error,
    canCreate,
    canReview,
    calls,
    totalCount,
    hasMore,
    locations,
    agents,
    scorecards,
    defaultAgent,
    defaultScorecard,
    awaitingReviewCount,
    getCriteriaForCall,
    createCall,
    updateCallReview,
    refresh,
    loadMore,
  }
}
