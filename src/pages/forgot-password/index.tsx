import { useState } from 'react'
import { Link } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: resetError } = await requestPasswordReset(email.trim())
    setBusy(false)
    if (resetError) {
      setError(resetError)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          {sent ? 'Check your inbox' : 'Reset your password'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sent ? (
            <>
              If an account exists for{' '}
              <span className="font-medium text-foreground">{email}</span>, we
              sent a reset link.
            </>
          ) : (
            'Enter your email and we will send a password reset link.'
          )}
        </p>
      </div>

      {sent ? (
        <Button type="button" variant="outline" className="w-full" asChild>
          <Link to="/login">Back to login</Link>
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          {error ? (
            <Alert variant="destructive" className="border-destructive/30">
              <WarningCircle weight="fill" />
              <AlertTitle>Couldn’t send reset email</AlertTitle>
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@company.com"
            />
          </Field>

          <Button
            type="submit"
            loading={busy}
            disabled={!email.trim()}
            className="w-full"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link
              to="/login"
              className="text-foreground underline underline-offset-2"
            >
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
