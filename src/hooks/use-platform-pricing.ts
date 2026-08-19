import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { parseUsd } from '@/lib/currency'

export interface PlatformPricing {
  voiceUsdPerMinute: number
  updatedAt: string | null
}

function mapPricing(row: {
  voice_usd_per_minute: number | string
  updated_at: string | null
}): PlatformPricing {
  return {
    voiceUsdPerMinute: parseUsd(row.voice_usd_per_minute),
    updatedAt: row.updated_at,
  }
}

export function usePlatformPricing() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<PlatformPricing | null>(null)
  const [voiceUsdPerMinute, setVoiceUsdPerMinute] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('platform_pricing')
      .select('voice_usd_per_minute, updated_at')
      .eq('id', 1)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setPricing(null)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Voice pricing is not configured yet.')
      setPricing(null)
      setLoading(false)
      return
    }

    const next = mapPricing(data)
    setPricing(next)
    setVoiceUsdPerMinute(String(next.voiceUsdPerMinute))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dirty = useMemo(() => {
    if (!pricing) return false
    const parsed = Number(voiceUsdPerMinute)
    if (!Number.isFinite(parsed)) return true
    return parsed !== pricing.voiceUsdPerMinute
  }, [pricing, voiceUsdPerMinute])

  const save = useCallback(async () => {
    const parsed = Number(voiceUsdPerMinute)

    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: 'Enter a valid rate of zero or greater.' }
    }

    setSaving(true)
    setError(null)

    const { data, error: saveError } = await supabase.rpc(
      'update_platform_pricing',
      { p_voice_usd_per_minute: parsed }
    )

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return { error: saveError.message }
    }

    if (!data) {
      const message = 'Could not save voice pricing.'
      setError(message)
      return { error: message }
    }

    const next = mapPricing(data)
    setPricing(next)
    setVoiceUsdPerMinute(String(next.voiceUsdPerMinute))
    return { error: null }
  }, [voiceUsdPerMinute])

  return {
    loading,
    saving,
    error,
    pricing,
    voiceUsdPerMinute,
    setVoiceUsdPerMinute,
    dirty,
    save,
    refresh,
  }
}
