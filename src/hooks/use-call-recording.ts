import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

const CALL_RECORDINGS_BUCKET = 'call-recordings'

export function useCallRecording(recordingPath: string | null) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recordingPath) {
      setSrc(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void supabase.storage
      .from(CALL_RECORDINGS_BUCKET)
      .createSignedUrl(recordingPath, 3600)
      .then(({ data, error: signedError }) => {
        if (cancelled) return
        if (signedError) {
          setError(signedError.message)
          setSrc(null)
        } else {
          setSrc(data?.signedUrl ?? null)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [recordingPath])

  return { src, loading, error }
}
