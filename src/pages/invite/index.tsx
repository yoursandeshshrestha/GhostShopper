import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase/client'

interface InvitePreview {
  org_name: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
}

export function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { session, profile, acceptInvitation, signInWithMagicLink, refreshProfile } =
    useAuth()
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data, error: fetchError } = await supabase.rpc(
        'get_invitation_by_token',
        { invite_token: token }
      )

      if (!mounted) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const row = Array.isArray(data) ? data[0] : data
      if (!row) {
        setError('Invitation not found.')
        setLoading(false)
        return
      }

      setInvite(row as InvitePreview)
      setLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [token])

  async function onAccept() {
    setBusy(true)
    setError(null)

    if (profile && !profile.fullName?.trim()) {
      const trimmed = fullName.trim()
      if (!trimmed) {
        setBusy(false)
        setError('Enter your name to continue.')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', profile.id)

      if (updateError) {
        setBusy(false)
        setError(updateError.message)
        return
      }

      await refreshProfile()
      setBusy(false)
      navigate(
        profile.role === 'superadmin'
          ? '/admin'
          : profile.role === 'owner'
            ? '/onboarding'
            : '/dashboard',
        { replace: true }
      )
      return
    }

    const { error: acceptError } = await acceptInvitation({
      token,
      fullName: fullName.trim() || undefined,
    })

    setBusy(false)

    if (acceptError) {
      setError(acceptError)
      return
    }

    navigate(invite?.role === 'superadmin' ? '/admin' : '/dashboard', {
      replace: true,
    })
  }

  async function onMagicLink() {
    if (!invite?.email) return
    setBusy(true)
    setError(null)
    const { error: magicError } = await signInWithMagicLink(
      invite.email,
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`
    )
    setBusy(false)

    if (magicError) {
      setError(magicError)
      return
    }

    setMagicSent(true)
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex justify-center">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-medium tracking-tight text-foreground">
            {invite?.role === 'superadmin'
              ? 'Join the platform'
              : 'Join organisation'}
          </h1>
          {invite ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {invite.role === 'superadmin' ? (
                <>
                  You have been invited as a{' '}
                  <span className="font-medium text-foreground">
                    platform superadmin
                  </span>{' '}
                  on GhostShopper.
                </>
              ) : (
                <>
                  You have been invited to{' '}
                  <span className="font-medium text-foreground">
                    {invite.org_name}
                  </span>{' '}
                  as{' '}
                  <span className="font-medium text-foreground">
                    {invite.role}
                  </span>
                  .
                </>
              )}
            </p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" className="border-destructive/30">
            <WarningCircle weight="fill" />
            <AlertTitle>Invitation problem</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {invite?.accepted_at ? (
          <p className="text-center text-sm text-muted-foreground">
            This invitation was already accepted.{' '}
            <Link to="/login" className="underline underline-offset-2">
              Log in
            </Link>
          </p>
        ) : null}

        {invite && !invite.accepted_at && !session ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Sign in with{' '}
              <span className="font-medium text-foreground">{invite.email}</span>{' '}
              to accept.
            </p>
            {magicSent ? (
              <p className="text-sm text-muted-foreground">
                Magic link sent. Open it on this device to continue.
              </p>
            ) : (
              <Button type="button" loading={busy} onClick={onMagicLink}>
                {busy ? 'Sending…' : 'Email me a magic link'}
              </Button>
            )}
          </div>
        ) : null}

        {invite && !invite.accepted_at && session && !profile ? (
          <div className="flex flex-col gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="fullName">Your name</FieldLabel>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Taylor"
              />
            </Field>
            <Button type="button" loading={busy} onClick={onAccept}>
              {busy ? 'Joining…' : invite?.role === 'superadmin' ? 'Join platform' : 'Accept invitation'}
            </Button>
          </div>
        ) : null}

        {invite &&
        !invite.accepted_at &&
        session &&
        profile &&
        !profile.fullName?.trim() ? (
          <div className="flex flex-col gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="fullName">Your name</FieldLabel>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Taylor"
              />
            </Field>
            <Button type="button" loading={busy} onClick={onAccept}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        ) : null}

        {session && profile && invite && !invite.accepted_at && invite.role === 'superadmin' && profile.role !== 'superadmin' ? (
          <p className="text-center text-sm text-muted-foreground">
            This invite is for a platform superadmin, but you already have an
            organisation account. Sign out and use the invited email, or ask
            someone to remove that org membership first.
          </p>
        ) : session && profile && profile.fullName?.trim() ? (
          <Button asChild>
            <Link to={profile.role === 'superadmin' ? '/admin' : '/dashboard'}>
              {profile.role === 'superadmin' ? 'Go to platform' : 'Go to dashboard'}
            </Link>
          </Button>
        ) : null}
      </div>
    </AuthLayout>
  )
}
