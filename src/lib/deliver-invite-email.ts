import { invokeFunction } from '@/lib/invoke-function'
import { authCallbackUrl } from '@/lib/auth-callback-url'
import { supabase } from '@/lib/supabase/client'

export async function deliverInviteEmail(input: {
  email: string
  orgName: string
  role: string
  token: string
  inviteUrl: string
}): Promise<{ error: string | null; emailed: boolean }> {
  const mailgun = await invokeFunction<{ ok?: boolean; error?: string }>(
    'send-invite-email',
    {
      email: input.email,
      orgName: input.orgName,
      role: input.role,
      token: input.token,
      inviteUrl: input.inviteUrl,
    }
  )

  if (!mailgun.error) {
    return { error: null, emailed: true }
  }

  const { error: magicError } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      emailRedirectTo: authCallbackUrl(),
    },
  })

  if (!magicError) {
    return { error: null, emailed: true }
  }

  return {
    emailed: false,
    error: `${mailgun.error} A login email also could not be sent (${magicError.message}). Copy the invite link instead.`,
  }
}
