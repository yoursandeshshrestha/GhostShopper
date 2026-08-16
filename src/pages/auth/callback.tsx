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
    let finished = false

    function go(path: string) {
      if (!mounted || finished) return
      finished = true
      navigate(path, { replace: true })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return
      if (event === 'PASSWORD_RECOVERY') {
        go('/reset-password')
        return
      }
      const next = params.get('next')
      if (next === '/reset-password') {
        go('/reset-password')
        return
      }
      go(next && next.startsWith('/') ? next : '/dashboard')
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted || finished) return
      if (sessionError) {
        setError(sessionError.message)
        return
      }
      if (!data.session) return
      const next = params.get('next')
      if (next === '/reset-password') {
        go('/reset-password')
        return
      }
      go(next && next.startsWith('/') ? next : '/dashboard')
    })

    const timeout = window.setTimeout(() => {
      if (!mounted || finished) return
      setError('No session found. Try the magic link again.')
    }, 8000)

    return () => {
      mounted = false
      window.clearTimeout(timeout)
      subscription.unsubscribe()
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
