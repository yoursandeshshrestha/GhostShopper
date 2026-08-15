import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { canManageTrainingConfig } from '@/lib/permissions'
import { supabase } from '@/lib/supabase/client'
import {
  createLocalId,
  DEFAULT_SCORECARD_CRITERIA,
  scorecardWeightTotal,
  type ScorecardCriterion,
} from '@/types/setup'

export interface ScorecardSummary {
  id: string
  name: string
  isDefault: boolean
  criteriaCount: number
  weightTotal: number
}

function mapCriteria(raw: unknown): ScorecardCriterion[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as {
      id?: string
      name?: string
      weight?: number
    }
    return {
      id: row.id || createLocalId(),
      name: row.name ?? '',
      weight: Number(row.weight) || 0,
    }
  })
}

function mapScorecardSummary(row: Record<string, unknown>): ScorecardSummary {
  const criteria = mapCriteria(row.criteria)
  return {
    id: row.id as string,
    name: (row.name as string) || 'Default Scorecard',
    isDefault: Boolean(row.is_default),
    criteriaCount: criteria.length,
    weightTotal: scorecardWeightTotal(criteria),
  }
}

export function useScorecardList() {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canManage = canManageTrainingConfig(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scorecards, setScorecards] = useState<ScorecardSummary[]>([])

  const refresh = useCallback(async () => {
    if (!orgId) {
      setScorecards([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('scorecards')
      .select('id, name, criteria, is_default')
      .eq('org_id', orgId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    setScorecards(
      (data ?? []).map((row) => mapScorecardSummary(row as Record<string, unknown>))
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createScorecard = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to create scorecards.' }
    }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('scorecards')
      .insert({
        org_id: orgId,
        name: `Scorecard ${scorecards.length + 1}`,
        criteria: DEFAULT_SCORECARD_CRITERIA.map((item) => ({
          ...item,
          id: createLocalId(),
        })),
        is_default: scorecards.length === 0,
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !data) {
      const message = insertError?.message ?? 'Could not create scorecard.'
      setError(message)
      return { error: message }
    }

    return { error: null, id: data.id as string }
  }, [canManage, orgId, scorecards.length])

  const deleteScorecard = useCallback(
    async (id: string) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to delete scorecards.' }
      }
      if (scorecards.length <= 1) {
        return { error: 'Keep at least one scorecard in your workspace.' }
      }

      const target = scorecards.find((item) => item.id === id)
      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('scorecards')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId)

      if (deleteError) {
        setSaving(false)
        setError(deleteError.message)
        return { error: deleteError.message }
      }

      if (target?.isDefault) {
        const { data: nextDefault } = await supabase
          .from('scorecards')
          .select('id')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextDefault?.id) {
          await supabase.rpc('set_default_scorecard', {
            p_scorecard_id: nextDefault.id,
          })
        }
      }

      setSaving(false)
      await refresh()
      return { error: null }
    },
    [canManage, orgId, refresh, scorecards]
  )

  const setDefaultScorecard = useCallback(
    async (id: string) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to change the default scorecard.' }
      }

      setSaving(true)
      setError(null)
      const { error: rpcError } = await supabase.rpc('set_default_scorecard', {
        p_scorecard_id: id,
      })
      setSaving(false)

      if (rpcError) {
        setError(rpcError.message)
        return { error: rpcError.message }
      }

      await refresh()
      return { error: null }
    },
    [canManage, orgId, refresh]
  )

  return {
    loading,
    saving,
    error,
    canManage,
    scorecards,
    createScorecard,
    deleteScorecard,
    setDefaultScorecard,
    refresh,
  }
}

export function useScorecardDetail(scorecardId: string) {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canManage = canManageTrainingConfig(profile?.role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('Default Scorecard')
  const [criteria, setCriteria] = useState<ScorecardCriterion[]>([])
  const [baseline, setBaseline] = useState<{
    name: string
    criteria: ScorecardCriterion[]
  }>({ name: 'Default Scorecard', criteria: [] })
  const [isDefault, setIsDefault] = useState(false)
  const [found, setFound] = useState(false)

  const loadScorecard = useCallback(async () => {
    if (!orgId || !scorecardId) {
      setName('Default Scorecard')
      setCriteria([])
      setBaseline({ name: 'Default Scorecard', criteria: [] })
      setFound(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('scorecards')
      .select('id, name, criteria, is_default')
      .eq('id', scorecardId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (queryError || !data) {
      setError(queryError?.message ?? 'Scorecard not found')
      setName('Default Scorecard')
      setCriteria([])
      setBaseline({ name: 'Default Scorecard', criteria: [] })
      setFound(false)
      setLoading(false)
      return
    }

    const nextCriteria = mapCriteria(data.criteria)
    const nextName = (data.name as string) || 'Default Scorecard'
    setName(nextName)
    setCriteria(nextCriteria)
    setIsDefault(Boolean(data.is_default))
    setBaseline({ name: nextName, criteria: nextCriteria })
    setFound(true)
    setLoading(false)
  }, [orgId, scorecardId])

  useEffect(() => {
    void loadScorecard()
  }, [loadScorecard])

  const dirty =
    name !== baseline.name ||
    JSON.stringify(criteria) !== JSON.stringify(baseline.criteria)

  const weightTotal = scorecardWeightTotal(criteria)

  const updateCriterion = useCallback(
    (id: string, patch: Partial<Pick<ScorecardCriterion, 'name' | 'weight'>>) => {
      setCriteria((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      )
    },
    []
  )

  const addCriterion = useCallback(() => {
    setCriteria((current) => [
      ...current,
      { id: createLocalId(), name: '', weight: 0 },
    ])
  }, [])

  const removeCriterion = useCallback((id: string) => {
    setCriteria((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== id)
    )
  }, [])

  const applyDefaultCriteria = useCallback(() => {
    setCriteria(
      DEFAULT_SCORECARD_CRITERIA.map((item) => ({
        ...item,
        id: createLocalId(),
      }))
    )
  }, [])

  const discardChanges = useCallback(() => {
    setName(baseline.name)
    setCriteria(baseline.criteria)
    setError(null)
  }, [baseline])

  const saveScorecard = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to edit the scorecard.' }
    }
    if (criteria.length === 0) {
      return { error: 'Add at least one criterion.' }
    }
    if (criteria.some((item) => !item.name.trim())) {
      return { error: 'Every criterion needs a name.' }
    }
    if (weightTotal !== 100) {
      return { error: `Weights must equal 100 (currently ${weightTotal}).` }
    }

    setSaving(true)
    setError(null)

    const payload = {
      org_id: orgId,
      name: name.trim() || 'Default Scorecard',
      criteria: criteria.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        weight: Number(item.weight) || 0,
      })),
    }

    const { data, error: saveError } = await supabase
      .from('scorecards')
      .update(payload)
      .eq('id', scorecardId)
      .eq('org_id', orgId)
      .select('id, name, criteria')
      .single()

    setSaving(false)

    if (saveError || !data) {
      const message = saveError?.message ?? 'Could not save scorecard.'
      setError(message)
      return { error: message }
    }

    const nextCriteria = mapCriteria(data.criteria)
    const nextName = (data.name as string) || 'Default Scorecard'
    setName(nextName)
    setCriteria(nextCriteria)
    setBaseline({ name: nextName, criteria: nextCriteria })
    return { error: null }
  }, [canManage, criteria, name, orgId, scorecardId, weightTotal])

  const deleteScorecard = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to delete scorecards.' }
    }

    setSaving(true)
    setError(null)

    const { count } = await supabase
      .from('scorecards')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)

    if ((count ?? 0) <= 1) {
      setSaving(false)
      return { error: 'Keep at least one scorecard in your workspace.' }
    }

    const { error: deleteError } = await supabase
      .from('scorecards')
      .delete()
      .eq('id', scorecardId)
      .eq('org_id', orgId)

    if (deleteError) {
      setSaving(false)
      setError(deleteError.message)
      return { error: deleteError.message }
    }

    if (isDefault) {
      const { data: nextDefault } = await supabase
        .from('scorecards')
        .select('id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextDefault?.id) {
        await supabase.rpc('set_default_scorecard', {
          p_scorecard_id: nextDefault.id,
        })
      }
    }

    setSaving(false)
    return { error: null }
  }, [canManage, isDefault, orgId, scorecardId])

  const setDefaultScorecard = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to change the default scorecard.' }
    }
    if (isDefault) return { error: null }

    setSaving(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('set_default_scorecard', {
      p_scorecard_id: scorecardId,
    })
    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return { error: rpcError.message }
    }

    await loadScorecard()
    return { error: null }
  }, [canManage, isDefault, loadScorecard, orgId, scorecardId])

  return {
    loading,
    saving,
    error,
    canManage,
    found,
    isDefault,
    name,
    setName,
    criteria,
    updateCriterion,
    addCriterion,
    removeCriterion,
    applyDefaultCriteria,
    discardChanges,
    saveScorecard,
    deleteScorecard,
    setDefaultScorecard,
    dirty,
    weightTotal,
    refresh: loadScorecard,
  }
}
