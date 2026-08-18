import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgContext } from '@/hooks/use-org-context'
import { invokeFunction } from '@/lib/invoke-function'
import { LIST_PAGE_SIZE, mergeById, pageRange } from '@/lib/pagination'
import {
  localTimeFromInput,
  nextOccurrence,
  type CallFrequency,
} from '@/lib/schedule-time'
import { canStartCalls } from '@/lib/permissions'
import { supabase } from '@/lib/supabase/client'
import type {
  CallScheduleInput,
  CallScheduleStatus,
  OrgCallSchedule,
} from '@/types/schedule'

export const SCHEDULES_LIST_SELECT =
  'id, location_id, scenario_id, scorecard_id, kind, status, frequency, timezone, local_time, next_run_at, last_run_at, last_call_id, last_error, retry_after_minutes, retry_count, max_retries, created_at, locations(name, timezone)'

export interface ScheduleLocationOption {
  id: string
  name: string
  timezone: string | null
  callFrequency: string | null
  phone: string | null
}

export interface ScheduleAgentOption {
  id: string
  name: string
  approved: boolean
  isDefault: boolean
}

export interface ScheduleScorecardOption {
  id: string
  name: string
  isDefault: boolean
}

function mapSchedule(row: Record<string, unknown>): OrgCallSchedule {
  const location = row.locations as
    | { name?: string; timezone?: string | null }
    | { name?: string; timezone?: string | null }[]
    | null
  const loc = Array.isArray(location) ? location[0] : location

  return {
    id: row.id as string,
    locationId: row.location_id as string,
    locationName: loc?.name || 'Unknown location',
    timezone:
      (row.timezone as string | null) || loc?.timezone || 'UTC',
    scenarioId: (row.scenario_id as string | null) ?? null,
    scorecardId: (row.scorecard_id as string | null) ?? null,
    kind: row.kind as OrgCallSchedule['kind'],
    status: row.status as CallScheduleStatus,
    frequency: (row.frequency as CallFrequency | null) ?? null,
    localTime: String(row.local_time ?? '10:00').slice(0, 5),
    nextRunAt: row.next_run_at as string,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    lastCallId: (row.last_call_id as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    retryAfterMinutes: (row.retry_after_minutes as number | null) ?? null,
    retryCount: (row.retry_count as number | null) ?? 0,
    maxRetries: (row.max_retries as number | null) ?? 2,
    createdAt: row.created_at as string,
  }
}

function sortSchedules(rows: OrgCallSchedule[]) {
  const rank: Record<CallScheduleStatus, number> = {
    active: 0,
    paused: 1,
    completed: 2,
    cancelled: 3,
  }
  return [...rows].sort((left, right) => {
    const byStatus = rank[left.status] - rank[right.status]
    if (byStatus !== 0) return byStatus
    return Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt)
  })
}

export function useSchedules() {
  const { profile, orgId } = useOrgContext()
  const canManage = canStartCalls(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<OrgCallSchedule[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [locations, setLocations] = useState<ScheduleLocationOption[]>([])
  const [agents, setAgents] = useState<ScheduleAgentOption[]>([])
  const [scorecards, setScorecards] = useState<ScheduleScorecardOption[]>([])
  const schedulesRef = useRef<OrgCallSchedule[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  schedulesRef.current = schedules
  totalCountRef.current = totalCount

  const upsert = useCallback((schedule: OrgCallSchedule) => {
    setSchedules((current) => {
      const index = current.findIndex((row) => row.id === schedule.id)
      if (index === -1) return sortSchedules([schedule, ...current])
      const next = [...current]
      next[index] = schedule
      return sortSchedules(next)
    })
  }, [])

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!orgId) {
        setSchedules([])
        setTotalCount(0)
        setLocations([])
        setAgents([])
        setScorecards([])
        setLoading(false)
        return
      }

      if (!reset && loadingMoreRef.current) return
      if (
        !reset &&
        totalCountRef.current > 0 &&
        schedulesRef.current.length >= totalCountRef.current
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

      const take = reset
        ? Math.max(LIST_PAGE_SIZE, schedulesRef.current.length)
        : LIST_PAGE_SIZE
      const { from, to } = pageRange(reset ? 0 : schedulesRef.current.length, take)

      const [schedulesRes, locationsRes, agentsRes, scorecardsRes] =
        await Promise.all([
          supabase
            .from('call_schedules')
            .select(SCHEDULES_LIST_SELECT, { count: reset ? 'exact' : undefined })
            .eq('org_id', orgId)
            .order('next_run_at', { ascending: true })
            .range(from, to),
          reset
            ? supabase
                .from('locations')
                .select('id, name, timezone, call_frequency, phone')
                .eq('org_id', orgId)
                .order('name', { ascending: true })
            : Promise.resolve({ data: null, error: null }),
          reset
            ? supabase
                .from('scenarios')
                .select('id, name, approved_at, is_default')
                .eq('org_id', orgId)
                .order('is_default', { ascending: false })
            : Promise.resolve({ data: null, error: null }),
          reset
            ? supabase
                .from('scorecards')
                .select('id, name, is_default')
                .eq('org_id', orgId)
                .order('is_default', { ascending: false })
            : Promise.resolve({ data: null, error: null }),
        ])

      const firstError =
        schedulesRes.error?.message ||
        (reset && locationsRes.error?.message) ||
        (reset && agentsRes.error?.message) ||
        (reset && scorecardsRes.error?.message) ||
        null

      if (firstError) {
        setError(firstError)
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
        return
      }

      const rows = (schedulesRes.data ?? []).map((row) =>
        mapSchedule(row as Record<string, unknown>)
      )
      setSchedules((current) =>
        reset ? sortSchedules(rows) : mergeById(current, rows, false)
      )
      if (typeof schedulesRes.count === 'number') {
        setTotalCount(schedulesRes.count)
      } else if (reset) {
        setTotalCount(rows.length)
      }

      if (reset) {
        setLocations(
          (locationsRes.data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            timezone: (row.timezone as string | null) ?? null,
            callFrequency: (row.call_frequency as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
          }))
        )
        setAgents(
          (agentsRes.data ?? []).map((row) => ({
            id: row.id as string,
            name: (row.name as string) || 'Untitled agent',
            approved: Boolean(row.approved_at),
            isDefault: Boolean(row.is_default),
          }))
        )
        setScorecards(
          (scorecardsRes.data ?? []).map((row) => ({
            id: row.id as string,
            name: (row.name as string) || 'Default Scorecard',
            isDefault: Boolean(row.is_default),
          }))
        )
      }

      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    },
    [orgId]
  )

  const refresh = useCallback(async () => {
    await fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`call_schedules:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_schedules',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, refresh])

  const createSchedule = useCallback(
    async (input: CallScheduleInput) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to schedule calls.' }
      }
      if (!input.locationId) return { error: 'Choose a location.' }
      if (!input.scenarioId) return { error: 'Choose an agent.' }
      if (!input.scorecardId) return { error: 'Choose a scorecard.' }
      if (input.kind === 'recurring' && !input.frequency) {
        return { error: 'Choose a frequency.' }
      }

      const location = locations.find((item) => item.id === input.locationId)
      const timeZone =
        input.timezone?.trim() || location?.timezone?.trim() || 'UTC'
      const localTime = localTimeFromInput(input.localTime)
      const nextRunAt = nextOccurrence({
        date: input.date,
        localTime,
        timeZone,
        frequency: input.kind === 'recurring' ? input.frequency : null,
      })

      if (
        input.kind === 'one_off' &&
        nextRunAt.getTime() <= Date.now() - 60_000
      ) {
        return { error: 'Pick a time in the future.' }
      }

      setSaving(true)
      setError(null)

      const { data, error: insertError } = await supabase
        .from('call_schedules')
        .insert({
          org_id: orgId,
          location_id: input.locationId,
          scenario_id: input.scenarioId,
          scorecard_id: input.scorecardId,
          kind: input.kind,
          status: 'active',
          frequency: input.kind === 'recurring' ? input.frequency : null,
          timezone: timeZone,
          local_time: localTime,
          next_run_at: nextRunAt.toISOString(),
          retry_after_minutes:
            input.retryAfterMinutes && input.retryAfterMinutes > 0
              ? input.retryAfterMinutes
              : null,
          retry_count: 0,
          created_by: profile?.id ?? null,
        })
        .select(SCHEDULES_LIST_SELECT)
        .single()

      setSaving(false)

      if (insertError || !data) {
        const message =
          insertError?.message?.includes('call_schedules_one_recurring')
            ? 'This location already has a recurring schedule. Pause or edit it instead.'
            : insertError?.message ?? 'Could not create schedule.'
        setError(message)
        return { error: message }
      }

      const created = mapSchedule(data as Record<string, unknown>)
      upsert(created)
      setTotalCount((count) => count + 1)
      return { error: null, schedule: created }
    },
    [canManage, locations, orgId, profile?.id, upsert]
  )

  const updateSchedule = useCallback(
    async (id: string, input: CallScheduleInput) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to update schedules.' }
      }
      if (!input.locationId) return { error: 'Choose a location.' }
      if (!input.scenarioId) return { error: 'Choose an agent.' }
      if (!input.scorecardId) return { error: 'Choose a scorecard.' }
      if (input.kind === 'recurring' && !input.frequency) {
        return { error: 'Choose a frequency.' }
      }

      const location = locations.find((item) => item.id === input.locationId)
      const timeZone =
        input.timezone?.trim() || location?.timezone?.trim() || 'UTC'
      const localTime = localTimeFromInput(input.localTime)
      const nextRunAt = nextOccurrence({
        date: input.date,
        localTime,
        timeZone,
        frequency: input.kind === 'recurring' ? input.frequency : null,
      })

      if (
        input.kind === 'one_off' &&
        nextRunAt.getTime() <= Date.now() - 60_000
      ) {
        return { error: 'Pick a time in the future.' }
      }

      setSaving(true)
      setError(null)

      const { data, error: updateError } = await supabase
        .from('call_schedules')
        .update({
          location_id: input.locationId,
          scenario_id: input.scenarioId,
          scorecard_id: input.scorecardId,
          kind: input.kind,
          frequency: input.kind === 'recurring' ? input.frequency : null,
          timezone: timeZone,
          local_time: localTime,
          next_run_at: nextRunAt.toISOString(),
          retry_after_minutes:
            input.retryAfterMinutes && input.retryAfterMinutes > 0
              ? input.retryAfterMinutes
              : null,
          retry_count: 0,
          claimed_until: null,
          last_error: null,
        })
        .eq('id', id)
        .select(SCHEDULES_LIST_SELECT)
        .single()

      setSaving(false)

      if (updateError || !data) {
        const message =
          updateError?.message?.includes('call_schedules_one_recurring')
            ? 'This location already has a recurring schedule. Pause or edit it instead.'
            : updateError?.message ?? 'Could not update schedule.'
        setError(message)
        return { error: message }
      }

      const updated = mapSchedule(data as Record<string, unknown>)
      upsert(updated)
      return { error: null, schedule: updated }
    },
    [canManage, locations, orgId, upsert]
  )

  const updateStatus = useCallback(
    async (id: string, status: CallScheduleStatus) => {
      if (!canManage) {
        return { error: 'You do not have permission to update schedules.' }
      }

      const { data, error: updateError } = await supabase
        .from('call_schedules')
        .update({ status, claimed_until: null })
        .eq('id', id)
        .select(SCHEDULES_LIST_SELECT)
        .single()

      if (updateError || !data) {
        const message = updateError?.message ?? 'Could not update schedule.'
        setError(message)
        return { error: message }
      }

      const updated = mapSchedule(data as Record<string, unknown>)
      upsert(updated)
      return { error: null }
    },
    [canManage, upsert]
  )

  const deleteSchedule = useCallback(
    async (id: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to delete schedules.' }
      }

      const { error: deleteError } = await supabase
        .from('call_schedules')
        .delete()
        .eq('id', id)

      if (deleteError) {
        const message = deleteError.message ?? 'Could not delete schedule.'
        setError(message)
        return { error: message }
      }

      setSchedules((current) => current.filter((row) => row.id !== id))
      setTotalCount((count) => Math.max(0, count - 1))
      return { error: null }
    },
    [canManage]
  )

  const dispatchDue = useCallback(async () => {
    if (!canManage) {
      return { error: 'You do not have permission to run schedules.' }
    }
    setDispatching(true)
    const { error: invokeError } = await invokeFunction(
      'dispatch-scheduled-calls',
      {}
    )
    setDispatching(false)
    if (invokeError) {
      setError(invokeError)
      return { error: invokeError }
    }
    await refresh()
    return { error: null }
  }, [canManage, refresh])

  const runNow = useCallback(
    async (scheduleId: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to run schedules.' }
      }
      setDispatching(true)
      const { error: invokeError } = await invokeFunction(
        'dispatch-scheduled-calls',
        { scheduleId }
      )
      setDispatching(false)
      if (invokeError) {
        setError(invokeError)
        return { error: invokeError }
      }
      await refresh()
      return { error: null }
    },
    [canManage, refresh]
  )

  const defaultAgent =
    agents.find((agent) => agent.isDefault) ?? agents[0] ?? null
  const defaultScorecard =
    scorecards.find((item) => item.isDefault) ?? scorecards[0] ?? null

  return {
    loading,
    loadingMore,
    saving,
    dispatching,
    error,
    canManage,
    schedules,
    totalCount,
    hasMore: schedules.length < totalCount,
    locations,
    agents,
    scorecards,
    defaultAgent,
    defaultScorecard,
    createSchedule,
    updateSchedule,
    updateStatus,
    deleteSchedule,
    dispatchDue,
    runNow,
    refresh,
    loadMore,
  }
}
