import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const DEV_USERS = [
  { email: 'user@example.com', password: 'sandesh@123' },
  { email: 'admin@ghostshopper.dev', password: 'sandesh@123' },
] as const

export function LoginPage() {
  const navigate = useNavigate()
  const { signInWithMagicLink, signInWithPassword } = useAuth()
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

  async function onDevLogin(devEmail: string, password: string) {
    setBusy(true)
    setError(null)
    const { error: signInError } = await signInWithPassword(devEmail, password)
    setBusy(false)

    if (signInError) {
      setError(signInError)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthLayout
      bottomLeft={
        import.meta.env.DEV ? (
          <div className="flex flex-col gap-1">
            {DEV_USERS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={busy}
                onClick={() => onDevLogin(account.email, account.password)}
                className="inline-flex items-center gap-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {busy ? <Spinner size="xs" /> : null}
                <span>{account.email}</span>
              </button>
            ))}
          </div>
        ) : null
      }
    >
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
