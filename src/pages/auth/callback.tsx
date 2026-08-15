import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Spinner } from '@/components/ui/spinner'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function finish() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (!data.session) {
        setError('No session found. Try the magic link again.')
        return
      }

      // Let ProtectedRoute / OnboardingRoute decide profile vs attestation.
      const next = params.get('next')
      navigate(next && next.startsWith('/') ? next : '/dashboard', {
        replace: true,
      })
    }

    void finish()

    return () => {
      mounted = false
    }
  }, [navigate, params])

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <>
            <Spinner size="md" className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
