import { useState } from 'react'
import { Link } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const { error: magicError } = await signInWithMagicLink(email.trim())
    setBusy(false)

    if (magicError) {
      setError(magicError)
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
            New here?{' '}
            <Link
              to="/login"
              className="text-foreground underline underline-offset-2"
              onClick={(e) => {
                e.preventDefault()
                setError(null)
              }}
            >
              Sign in with your work email
            </Link>
            {' '}
            — we will route you to onboarding if you do not have a profile yet.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
