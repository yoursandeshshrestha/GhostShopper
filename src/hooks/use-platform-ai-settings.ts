import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface PlatformAiSettings {
  scenarioModel: string
  gradingModel: string
  updatedAt: string | null
}

function mapSettings(row: {
  scenario_model: string
  grading_model: string
  updated_at: string | null
}): PlatformAiSettings {
  return {
    scenarioModel: row.scenario_model,
    gradingModel: row.grading_model,
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

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('platform_ai_settings')
      .select('scenario_model, grading_model, updated_at')
      .eq('id', 1)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setSettings(null)
      setLoading(false)
      return
    }

    if (!data) {
      setError('AI model settings are not configured yet.')
      setSettings(null)
      setLoading(false)
      return
    }

    const next = mapSettings(data)
    setSettings(next)
    setScenarioModel(next.scenarioModel)
    setGradingModel(next.gradingModel)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dirty = useMemo(() => {
    if (!settings) return false
    return (
      scenarioModel.trim() !== settings.scenarioModel ||
      gradingModel.trim() !== settings.gradingModel
    )
  }, [gradingModel, scenarioModel, settings])

  const save = useCallback(async () => {
    const nextScenario = scenarioModel.trim()
    const nextGrading = gradingModel.trim()

    if (!nextScenario || !nextGrading) {
      return { error: 'Both model IDs are required.' }
    }

    setSaving(true)
    setError(null)

    const { data, error: saveError } = await supabase.rpc(
      'update_platform_ai_settings',
      {
        p_scenario_model: nextScenario,
        p_grading_model: nextGrading,
      }
    )

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return { error: saveError.message }
    }

    if (!data) {
      const message = 'Could not save AI model settings.'
      setError(message)
      return { error: message }
    }

    const next = mapSettings(data)
    setSettings(next)
    setScenarioModel(next.scenarioModel)
    setGradingModel(next.gradingModel)
    return { error: null }
  }, [gradingModel, scenarioModel])

  return {
    loading,
    saving,
    error,
    settings,
    scenarioModel,
    setScenarioModel,
    gradingModel,
    setGradingModel,
    dirty,
    save,
    refresh,
  }
}
