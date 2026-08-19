import { useCallback, useEffect, useState } from 'react'
import {
  loadOpenRouterModels,
  type OpenRouterModel,
} from '@/lib/openrouter-models'

export function useOpenRouterModels() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<OpenRouterModel[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setModels(await loadOpenRouterModels())
    } catch (caught) {
      setModels([])
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not load OpenRouter models.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loading, error, models, refresh }
}
