import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      </AuthLayout>
    )
  }

  if (!session) {
    return <Navigate to="/forgot-password" replace />
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    setError(null)
    const { error: updateError } = await updatePassword(password)
    setBusy(false)
    if (updateError) {
      setError(updateError)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This updates the password for {session.user.email}.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {error ? (
          <Alert variant="destructive" className="border-destructive/30">
            <WarningCircle weight="fill" />
            <AlertTitle>Couldn’t update password</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Field className="gap-2">
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <Button type="submit" loading={busy} className="w-full">
          {busy ? 'Saving…' : 'Save password'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="text-foreground underline underline-offset-2"
          >
            Back to login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
