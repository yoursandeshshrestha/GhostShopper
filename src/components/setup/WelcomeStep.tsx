import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { useSetupStore } from '@/stores/setup-store'

export function WelcomeStep() {
  const { profile, refreshProfile } = useAuth()
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const needsName = !profile?.fullName?.trim()

  async function onContinue() {
    setError(null)

    if (needsName) {
      const trimmed = fullName.trim()
      if (!trimmed) {
        setError('Enter your name to continue.')
        return
      }

      if (!profile?.id) {
        setError('Profile not found. Try signing in again.')
        return
      }

      setBusy(true)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', profile.id)
      setBusy(false)

      if (updateError) {
        setError(updateError.message)
        return
      }

      await refreshProfile()
    }

    await setStep('locations')
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8 text-left">
        <div className="space-y-3">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Welcome to GhostShopper
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Let’s configure your organization so mystery-shop calls can start.
            This usually takes about 5 minutes — you can leave and continue
            anytime.
          </p>
        </div>

        {needsName ? (
          <Field className="gap-2">
            <FieldLabel htmlFor="setup-full-name">Your name</FieldLabel>
            <Input
              id="setup-full-name"
              autoFocus
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Taylor"
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </Field>
        ) : null}

        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Add the locations you want called</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Choose how staff conversations are scored</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Approve an AI customer scenario</span>
          </li>
        </ul>

        <Button
          type="button"
          className="w-full"
          loading={saving || busy}
          disabled={needsName && !fullName.trim()}
          onClick={() => void onContinue()}
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}
