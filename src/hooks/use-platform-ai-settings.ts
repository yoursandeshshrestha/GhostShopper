import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_CALLER_SYSTEM_PROMPT,
  DEFAULT_GRADING_SYSTEM_PROMPT,
  DEFAULT_SCENARIO_SYSTEM_PROMPT,
} from '@/lib/default-ai-prompts'
import { supabase } from '@/lib/supabase/client'

export interface PlatformAiSettings {
  scenarioModel: string
  gradingModel: string
  callerSystemPrompt: string
  scenarioSystemPrompt: string
  gradingSystemPrompt: string
  updatedAt: string | null
}

function mapSettings(row: {
  scenario_model: string
  grading_model: string
  caller_system_prompt?: string | null
  scenario_system_prompt?: string | null
  grading_system_prompt?: string | null
  updated_at: string | null
}): PlatformAiSettings {
  return {
    scenarioModel: row.scenario_model,
    gradingModel: row.grading_model,
    callerSystemPrompt:
      row.caller_system_prompt?.trim() || DEFAULT_CALLER_SYSTEM_PROMPT,
    scenarioSystemPrompt:
      row.scenario_system_prompt?.trim() || DEFAULT_SCENARIO_SYSTEM_PROMPT,
    gradingSystemPrompt:
      row.grading_system_prompt?.trim() || DEFAULT_GRADING_SYSTEM_PROMPT,
    updatedAt: row.updated_at,
  }
}

export function usePlatformAiSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<PlatformAiSettings | null>(null)
  const [scenarioModel, setScenarioModel] = useState('')
  const [gradingModel, setGradingModel] = useState('')
  const [callerSystemPrompt, setCallerSystemPrompt] = useState('')
  const [scenarioSystemPrompt, setScenarioSystemPrompt] = useState('')
  const [gradingSystemPrompt, setGradingSystemPrompt] = useState('')

  const applySettings = useCallback((next: PlatformAiSettings) => {
    setSettings(next)
    setScenarioModel(next.scenarioModel)
    setGradingModel(next.gradingModel)
    setCallerSystemPrompt(next.callerSystemPrompt)
    setScenarioSystemPrompt(next.scenarioSystemPrompt)
    setGradingSystemPrompt(next.gradingSystemPrompt)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('platform_ai_settings')
      .select(
        'scenario_model, grading_model, caller_system_prompt, scenario_system_prompt, grading_system_prompt, updated_at'
      )
      .eq('id', 1)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setSettings(null)
      setLoading(false)
      return
    }

    if (!data) {
      setError('AI settings are not configured yet.')
      setSettings(null)
      setLoading(false)
      return
    }

    applySettings(mapSettings(data))
    setLoading(false)
  }, [applySettings])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dirty = useMemo(() => {
    if (!settings) return false
    return (
      scenarioModel.trim() !== settings.scenarioModel ||
      gradingModel.trim() !== settings.gradingModel ||
      callerSystemPrompt.trim() !== settings.callerSystemPrompt ||
      scenarioSystemPrompt.trim() !== settings.scenarioSystemPrompt ||
      gradingSystemPrompt.trim() !== settings.gradingSystemPrompt
    )
  }, [
    callerSystemPrompt,
    gradingModel,
    gradingSystemPrompt,
    scenarioModel,
    scenarioSystemPrompt,
    settings,
  ])

  const save = useCallback(async () => {
    const nextScenario = scenarioModel.trim()
    const nextGrading = gradingModel.trim()
    const nextCallerPrompt = callerSystemPrompt.trim()
    const nextScenarioPrompt = scenarioSystemPrompt.trim()
    const nextGradingPrompt = gradingSystemPrompt.trim()

    if (!nextScenario || !nextGrading) {
      return { error: 'Both model IDs are required.' }
    }
    if (!nextCallerPrompt) {
      return { error: 'Live caller prompt is required.' }
    }
    if (!nextScenarioPrompt) {
      return { error: 'Scenario prompt is required.' }
    }
    if (!nextGradingPrompt) {
      return { error: 'Call analysis prompt is required.' }
    }

    setSaving(true)
    setError(null)

    const { data, error: saveError } = await supabase.rpc(
      'update_platform_ai_settings',
      {
        p_scenario_model: nextScenario,
        p_grading_model: nextGrading,
        p_caller_system_prompt: nextCallerPrompt,
        p_scenario_system_prompt: nextScenarioPrompt,
        p_grading_system_prompt: nextGradingPrompt,
      }
    )

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return { error: saveError.message }
    }

    if (!data) {
      const message = 'Could not save AI settings.'
      setError(message)
      return { error: message }
    }

    applySettings(mapSettings(data))
    return { error: null }
  }, [
    applySettings,
    callerSystemPrompt,
    gradingModel,
    gradingSystemPrompt,
    scenarioModel,
    scenarioSystemPrompt,
  ])

  return {
    loading,
    saving,
    error,
    settings,
    scenarioModel,
    setScenarioModel,
    gradingModel,
    setGradingModel,
    callerSystemPrompt,
    setCallerSystemPrompt,
    scenarioSystemPrompt,
    setScenarioSystemPrompt,
    gradingSystemPrompt,
    setGradingSystemPrompt,
    dirty,
    save,
    refresh,
  }
}
