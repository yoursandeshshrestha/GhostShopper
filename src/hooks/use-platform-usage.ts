import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { parseUsd } from '@/lib/currency'
import { mergeById, pageRange } from '@/lib/pagination'

export type UsageOperation = 'voice_call' | 'call_grade' | 'scenario_gen'

export const USAGE_OPERATION_LABELS: Record<UsageOperation, string> = {
  voice_call: 'Voice call',
  call_grade: 'Call grading',
  scenario_gen: 'Scenario generation',
}

export interface UsageSummaryRow {
  operation: UsageOperation
  eventCount: number
  totalCostUsd: number
}

export interface UsageByOrgRow {
  orgId: string
  orgName: string
  voiceCallCost: number
  callGradeCost: number
  scenarioGenCost: number
  totalCostUsd: number
  eventCount: number
}

export interface UsageEventRow {
  id: string
  orgId: string
  orgName: string
  service: string
  operation: UsageOperation
  resourceId: string | null
  units: Record<string, unknown>
  costUsd: number
  metadata: Record<string, unknown>
  createdAt: string
  locationName: string | null
}

function mapSummaryRow(row: Record<string, unknown>): UsageSummaryRow {
  return {
    operation: row.operation as UsageOperation,
    eventCount: Number(row.event_count) || 0,
    totalCostUsd: parseUsd(row.total_cost_usd),
  }
}

function mapOrgRow(row: Record<string, unknown>): UsageByOrgRow {
  return {
    orgId: row.org_id as string,
    orgName: (row.org_name as string) ?? 'Unknown org',
    voiceCallCost: parseUsd(row.voice_call_cost),
    callGradeCost: parseUsd(row.call_grade_cost),
    scenarioGenCost: parseUsd(row.scenario_gen_cost),
    totalCostUsd: parseUsd(row.total_cost_usd),
    eventCount: Number(row.event_count) || 0,
  }
}

function mapEventRow(row: Record<string, unknown>): UsageEventRow {
  const org = row.orgs as { name?: string } | { name?: string }[] | null
  const orgRecord = Array.isArray(org) ? org[0] : org
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    orgName: orgRecord?.name ?? 'Unknown org',
    service: row.service as string,
    operation: row.operation as UsageOperation,
    resourceId: (row.resource_id as string | null) ?? null,
    units: (row.units as Record<string, unknown>) ?? {},
    costUsd: parseUsd(row.cost_usd),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    locationName: null,
  }
}

export function usePlatformUsage(orgId?: string | null) {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<UsageSummaryRow[]>([])
  const [byOrg, setByOrg] = useState<UsageByOrgRow[]>([])
  const [events, setEvents] = useState<UsageEventRow[]>([])
  const [totalEventCount, setTotalEventCount] = useState(0)
  const itemsRef = useRef<UsageEventRow[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  itemsRef.current = events
  totalCountRef.current = totalEventCount

  const fetchEventsPage = useCallback(
    async (
      reset: boolean,
      filterOrgId?: string | null
    ): Promise<{ error: string | null }> => {
      if (!reset && loadingMoreRef.current) return { error: null }
      if (
        !reset &&
        totalCountRef.current > 0 &&
        itemsRef.current.length >= totalCountRef.current
      ) {
        return { error: null }
      }

      if (!reset) {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const { from, to } = pageRange(reset ? 0 : itemsRef.current.length)
      let query = supabase
        .from('usage_events')
        .select(
          'id, org_id, service, operation, resource_id, units, cost_usd, metadata, created_at, orgs(name)',
          { count: reset ? 'exact' : undefined }
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filterOrgId) {
        query = query.eq('org_id', filterOrgId)
      }

      const { data, error: queryError, count } = await query

      if (queryError) {
        setError(queryError.message)
        setLoadingMore(false)
        loadingMoreRef.current = false
        return { error: queryError.message }
      }

      const rows = (data ?? []).map((row) =>
        mapEventRow(row as Record<string, unknown>)
      )
      setEvents((current) => mergeById(current, rows, reset))
      if (typeof count === 'number') setTotalEventCount(count)
      else if (reset) setTotalEventCount(rows.length)

      setLoadingMore(false)
      loadingMoreRef.current = false
      return { error: null }
    },
    []
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const summaryPromise = orgId
      ? supabase.rpc('get_org_usage_summary', { p_org_id: orgId })
      : supabase.rpc('get_platform_usage_summary')

    const byOrgPromise = orgId
      ? Promise.resolve({ data: null, error: null })
      : supabase.rpc('get_platform_usage_by_org')

    const [summaryResult, byOrgResult, eventsResult] = await Promise.all([
      summaryPromise,
      byOrgPromise,
      fetchEventsPage(true, orgId),
    ])

    const firstError =
      summaryResult.error?.message ||
      byOrgResult.error?.message ||
      eventsResult.error ||
      null

    if (firstError) {
      setError(firstError)
      setLoading(false)
      return
    }

    setSummary(
      (summaryResult.data ?? []).map((row: Record<string, unknown>) =>
        mapSummaryRow(row)
      )
    )

    if (!orgId) {
      setByOrg(
        (byOrgResult.data ?? []).map((row: Record<string, unknown>) =>
          mapOrgRow(row)
        )
      )
    } else {
      setByOrg([])
    }

    setLoading(false)
  }, [fetchEventsPage, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(() => {
    void fetchEventsPage(false, orgId)
  }, [fetchEventsPage, orgId])

  const backfill = useCallback(async () => {
    setError(null)
    const { data, error: backfillError } = await supabase.rpc(
      'backfill_usage_events'
    )

    if (backfillError) {
      setError(backfillError.message)
      return { error: backfillError.message, voiceInserted: 0, gradeInserted: 0 }
    }

    const row = (data ?? {}) as Record<string, unknown>
    await refresh()

    return {
      error: null,
      voiceInserted: Number(row.voice_inserted) || 0,
      gradeInserted: Number(row.grade_inserted) || 0,
    }
  }, [refresh])

  const totalCostUsd = summary.reduce((sum, row) => sum + row.totalCostUsd, 0)
  const totalEvents = summary.reduce((sum, row) => sum + row.eventCount, 0)
  const hasMore =
    totalEventCount > 0 ? events.length < totalEventCount : events.length > 0

  return {
    loading,
    loadingMore,
    error,
    summary,
    byOrg,
    events,
    totalCostUsd,
    totalEvents,
    totalEventCount,
    hasMore,
    loadMore,
    backfill,
    refresh,
  }
}

export function formatUsageUnits(
  operation: UsageOperation,
  units: Record<string, unknown>
) {
  if (operation === 'voice_call') {
    const secs = Number(units.duration_secs) || 0
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`
  }

  const prompt = Number(units.prompt_tokens) || 0
  const completion = Number(units.completion_tokens) || 0
  const model =
    typeof units.model === 'string' ? units.model.split('/').pop() : null
  const tokenPart = `${prompt.toLocaleString()} in · ${completion.toLocaleString()} out`
  return model ? `${tokenPart} · ${model}` : tokenPart
}
