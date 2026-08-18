import { useState } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { requestLogin } from '@/lib/request-login'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const { error: loginError, suspended } = await requestLogin(email.trim())
    setBusy(false)

    if (loginError) {
      setError(loginError)
      if (suspended) setSent(false)
      return
    }

    setSent(true)
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          {sent ? 'Check your inbox' : 'Log in to your account'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sent ? (
            <>
              We sent a magic link to{' '}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            'Enter your email and we will send you a magic link.'
          )}
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setSent(false)}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          {error ? (
            <Alert variant="destructive" className="border-destructive/30">
              <WarningCircle weight="fill" />
              <AlertTitle>Couldn’t send link</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Field className="gap-2">
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@company.com"
            />
          </Field>

          <Button
            type="submit"
            loading={busy}
            disabled={!email.trim()}
            className="w-full"
          >
            {busy ? 'Sending…' : 'Email me a magic link'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            If you were invited to a team, sign in with that email and you will
            join automatically. New organisations start onboarding after sign-in.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
