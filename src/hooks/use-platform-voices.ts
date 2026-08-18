import { useCallback, useEffect, useState } from 'react'
import { invokeFunction } from '@/lib/invoke-function'
import { supabase } from '@/lib/supabase/client'

export type VoiceGender = 'female' | 'male' | 'neutral'

export interface PlatformVoice {
  voiceId: string
  name: string
  previewUrl: string | null
  labels: Record<string, string>
  category: string | null
  description: string | null
  languages: string[]
  gender: VoiceGender
  enabled: boolean
}

function isVoiceGender(value: unknown): value is VoiceGender {
  return value === 'female' || value === 'male' || value === 'neutral'
}

export function usePlatformVoices() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<PlatformVoice[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: invokeError } = await invokeFunction<{
      voices?: PlatformVoice[]
      error?: string
    }>('platform-voices', { action: 'catalog' })

    if (invokeError) {
      setError(invokeError)
      setVoices([])
      setLoading(false)
      return
    }

    setVoices(
      (data?.voices ?? []).map((voice) => ({
        ...voice,
        category: voice.category ?? null,
        description: voice.description ?? null,
        languages: Array.isArray(voice.languages) ? voice.languages : [],
        labels: voice.labels ?? {},
        gender: isVoiceGender(voice.gender) ? voice.gender : 'neutral',
        enabled: Boolean(voice.enabled),
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveVoice = useCallback(
    async (
      voice: PlatformVoice,
      patch: Partial<Pick<PlatformVoice, 'enabled' | 'gender'>>
    ) => {
      const next: PlatformVoice = { ...voice, ...patch }
      setSavingId(voice.voiceId)
      setError(null)
      setVoices((current) =>
        current.map((row) => (row.voiceId === voice.voiceId ? next : row))
      )

      const { error: saveError } = await supabase.from('platform_voices').upsert(
        {
          elevenlabs_voice_id: next.voiceId,
          name: next.name,
          gender: next.gender,
          preview_url: next.previewUrl,
          labels: next.labels,
          enabled: next.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'elevenlabs_voice_id' }
      )

      setSavingId(null)

      if (saveError) {
        setError(saveError.message)
        setVoices((current) =>
          current.map((row) => (row.voiceId === voice.voiceId ? voice : row))
        )
        return { error: saveError.message }
      }

      return { error: null }
    },
    []
  )

  return {
    loading,
    savingId,
    error,
    voices,
    enabledCount: voices.filter((voice) => voice.enabled).length,
    refresh,
    saveVoice,
  }
}
