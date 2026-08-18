import { invokeFunction } from '@/lib/invoke-function'
import { supabase } from '@/lib/supabase/client'
import { authCallbackUrl } from '@/lib/auth-callback-url'

export async function requestLogin(email: string): Promise<{
  error: string | null
  suspended?: boolean
}> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) {
    return { error: 'Email is required.' }
  }

  const check = await invokeFunction<{
    allowed?: boolean
    suspended?: boolean
    error?: string
  }>('check-login', { email: trimmed })

  if (check.error && !check.data?.suspended) {
    return {
      error:
        check.error === 'Failed to send a request to the Edge Function'
          ? null
          : check.error,
    }
  }

  if (check.data?.suspended) {
    return {
      error:
        'Your account has been suspended. We sent you an email with details — contact your administrator to restore access.',
      suspended: true,
    }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: authCallbackUrl(),
    },
  })

  return { error: error?.message ?? null }
}
