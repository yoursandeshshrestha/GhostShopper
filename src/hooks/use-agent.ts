import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { canManageTrainingConfig } from '@/lib/permissions'
import { invokeFunction } from '@/lib/invoke-function'
import { supabase } from '@/lib/supabase/client'

export interface AgentScenario {
  id: string | null
  name: string
  prompt: string
  persona: string
  goals: string
  conversationRules: string
  approved: boolean
  isDefault: boolean
}

export interface AgentSummary {
  id: string
  name: string
  approved: boolean
  isDefault: boolean
  promptPreview: string
}

const emptyScenario = (): AgentScenario => ({
  id: null,
  name: '',
  prompt: '',
  persona: '',
  goals: '',
  conversationRules: '',
  approved: false,
  isDefault: false,
})

function mapScenarioRow(row: Record<string, unknown>): AgentScenario {
  return {
    id: row.id as string,
    name: (row.name as string) || 'Untitled agent',
    prompt: (row.prompt as string) || '',
    persona: (row.persona as string) || '',
    goals: (row.goals as string) || '',
    conversationRules: (row.conversation_rules as string) || '',
    approved: Boolean(row.approved_at),
    isDefault: Boolean(row.is_default),
  }
}

function mapAgentSummary(row: Record<string, unknown>): AgentSummary {
  const prompt = (row.prompt as string) || ''
  return {
    id: row.id as string,
    name: (row.name as string) || 'Untitled agent',
    approved: Boolean(row.approved_at),
    isDefault: Boolean(row.is_default),
    promptPreview: prompt.trim() || 'No customer brief yet',
  }
}

export function useAgentList() {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canManage = canManageTrainingConfig(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])

  const refresh = useCallback(async () => {
    if (!orgId) {
      setAgents([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('scenarios')
      .select('id, name, prompt, approved_at, is_default')
      .eq('org_id', orgId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    setAgents((data ?? []).map((row) => mapAgentSummary(row as Record<string, unknown>)))
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createAgent = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to create agents.' }
    }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('scenarios')
      .insert({
        org_id: orgId,
        name: `Agent ${agents.length + 1}`,
        prompt: '',
        persona: '',
        goals: '',
        conversation_rules: '',
        is_default: agents.length === 0,
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !data) {
      const message = insertError?.message ?? 'Could not create agent.'
      setError(message)
      return { error: message }
    }

    return { error: null, id: data.id as string }
  }, [agents.length, canManage, orgId])

  const deleteAgent = useCallback(
    async (agentId: string) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to delete agents.' }
      }
      if (agents.length <= 1) {
        return { error: 'Keep at least one agent in your workspace.' }
      }

      const target = agents.find((agent) => agent.id === agentId)
      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', agentId)
        .eq('org_id', orgId)

      if (deleteError) {
        setSaving(false)
        setError(deleteError.message)
        return { error: deleteError.message }
      }

      if (target?.isDefault) {
        const { data: nextDefault } = await supabase
          .from('scenarios')
          .select('id')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextDefault?.id) {
          await supabase.rpc('set_default_scenario', {
            p_scenario_id: nextDefault.id,
          })
        }
      }

      setSaving(false)
      await refresh()
      return { error: null }
    },
    [agents, canManage, orgId, refresh]
  )

  const setDefaultAgent = useCallback(
    async (agentId: string) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to change the default agent.' }
      }

      setSaving(true)
      setError(null)
      const { error: rpcError } = await supabase.rpc('set_default_scenario', {
        p_scenario_id: agentId,
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
    agents,
    createAgent,
    deleteAgent,
    setDefaultAgent,
    refresh,
  }
}

export function useAgentDetail(agentId: string) {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canManage = canManageTrainingConfig(profile?.role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<AgentScenario>(emptyScenario())
  const [baseline, setBaseline] = useState<AgentScenario>(emptyScenario())
  const [found, setFound] = useState(false)

  const loadScenario = useCallback(async () => {
    if (!orgId || !agentId) {
      setScenario(emptyScenario())
      setBaseline(emptyScenario())
      setFound(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('scenarios')
      .select(
        'id, name, prompt, persona, goals, conversation_rules, approved_at, is_default'
      )
      .eq('id', agentId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (queryError || !data) {
      setError(queryError?.message ?? 'Agent not found')
      setScenario(emptyScenario())
      setBaseline(emptyScenario())
      setFound(false)
      setLoading(false)
      return
    }

    const next = mapScenarioRow(data as Record<string, unknown>)
    setScenario(next)
    setBaseline(next)
    setFound(true)
    setLoading(false)
  }, [agentId, orgId])

  useEffect(() => {
    void loadScenario()
  }, [loadScenario])

  const dirty = JSON.stringify(scenario) !== JSON.stringify(baseline)

  const setName = useCallback((name: string) => {
    setScenario((current) => ({
      ...current,
      name,
      approved: false,
    }))
  }, [])

  const setPrompt = useCallback((prompt: string) => {
    setScenario((current) => ({
      ...current,
      prompt,
      approved: false,
    }))
  }, [])

  const [generating, setGenerating] = useState(false)

  const generateScenario = useCallback(async () => {
    const prompt = scenario.prompt.trim()
    if (!prompt) {
      return { error: 'Describe the customer scenario first.' }
    }

    setGenerating(true)
    setError(null)

    const { data, error: invokeError } = await invokeFunction<{
      persona?: string
      goals?: string
      conversationRules?: string
      error?: string
    }>('generate-scenario', { prompt })

    setGenerating(false)

    if (invokeError || !data?.persona) {
      const message = invokeError ?? 'Could not generate scenario.'
      setError(message)
      return { error: message }
    }

    setScenario((current) => ({
      ...current,
      persona: data.persona ?? '',
      goals: data.goals ?? '',
      conversationRules: data.conversationRules ?? '',
      approved: false,
    }))

    return { error: null }
  }, [scenario.prompt])

  const updateField = useCallback(
    (field: 'persona' | 'goals' | 'conversationRules', value: string) => {
      setScenario((current) => ({
        ...current,
        [field]: value,
        approved: false,
      }))
    },
    []
  )

  const discardChanges = useCallback(() => {
    setScenario(baseline)
    setError(null)
  }, [baseline])

  const saveAndApprove = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to edit the agent.' }
    }
    if (!scenario.name.trim()) {
      return { error: 'Give this agent a name.' }
    }
    if (!scenario.prompt.trim()) {
      return { error: 'Describe the customer scenario first.' }
    }
    if (
      !scenario.persona.trim() ||
      !scenario.goals.trim() ||
      !scenario.conversationRules.trim()
    ) {
      return {
        error: 'Generate or fill persona, goals, and conversation rules.',
      }
    }

    setSaving(true)
    setError(null)

    const payload = {
      org_id: orgId,
      name: scenario.name.trim(),
      prompt: scenario.prompt.trim(),
      persona: scenario.persona.trim(),
      goals: scenario.goals.trim(),
      conversation_rules: scenario.conversationRules.trim(),
      approved_at: new Date().toISOString(),
    }

    const { data, error: saveError } = await supabase
      .from('scenarios')
      .update(payload)
      .eq('id', agentId)
      .eq('org_id', orgId)
      .select(
        'id, name, prompt, persona, goals, conversation_rules, approved_at, is_default'
      )
      .single()

    setSaving(false)

    if (saveError || !data) {
      const message = saveError?.message ?? 'Could not save scenario.'
      setError(message)
      return { error: message }
    }

    const next = mapScenarioRow(data as Record<string, unknown>)
    setScenario(next)
    setBaseline(next)
    return { error: null }
  }, [agentId, canManage, orgId, scenario])

  const deleteAgent = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to delete agents.' }
    }

    setSaving(true)
    setError(null)

    const { count } = await supabase
      .from('scenarios')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)

    if ((count ?? 0) <= 1) {
      setSaving(false)
      return { error: 'Keep at least one agent in your workspace.' }
    }

    const wasDefault = scenario.isDefault
    const { error: deleteError } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', agentId)
      .eq('org_id', orgId)

    if (deleteError) {
      setSaving(false)
      setError(deleteError.message)
      return { error: deleteError.message }
    }

    if (wasDefault) {
      const { data: nextDefault } = await supabase
        .from('scenarios')
        .select('id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextDefault?.id) {
        await supabase.rpc('set_default_scenario', {
          p_scenario_id: nextDefault.id,
        })
      }
    }

    setSaving(false)
    return { error: null }
  }, [agentId, canManage, orgId, scenario.isDefault])

  const setDefaultAgent = useCallback(async () => {
    if (!orgId || !canManage) {
      return { error: 'You do not have permission to change the default agent.' }
    }
    if (scenario.isDefault) return { error: null }

    setSaving(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('set_default_scenario', {
      p_scenario_id: agentId,
    })
    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return { error: rpcError.message }
    }

    await loadScenario()
    return { error: null }
  }, [agentId, canManage, loadScenario, orgId, scenario.isDefault])

  return {
    loading,
    saving,
    generating,
    error,
    canManage,
    found,
    scenario,
    dirty,
    setName,
    setPrompt,
    generateScenario,
    updateField,
    discardChanges,
    saveAndApprove,
    deleteAgent,
    setDefaultAgent,
    refresh: loadScenario,
  }
}
