import { useState } from 'react'
import { Check, Copy, EnvelopeSimple, Plus, Trash } from '@phosphor-icons/react'
import type { OrgRole } from '@/components/auth/AuthProvider'
import { StepFooter, StepFrame, StepHeader } from '@/components/setup/StepChrome'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSetupStore } from '@/stores/setup-store'

const ROLE_OPTIONS: { value: Exclude<OrgRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'location_viewer', label: 'Location Viewer' },
]

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`
}

export function TeamStep() {
  const invites = useSetupStore((s) => s.invites)
  const locations = useSetupStore((s) => s.locations)
  const addInviteDraft = useSetupStore((s) => s.addInviteDraft)
  const updateInvite = useSetupStore((s) => s.updateInvite)
  const removeInvite = useSetupStore((s) => s.removeInvite)
  const saveInvite = useSetupStore((s) => s.saveInvite)
  const sendInviteEmail = useSetupStore((s) => s.sendInviteEmail)
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)

  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function onSaveInvite(id: string) {
    setError(null)
    const { error: saveError } = await saveInvite(id)
    if (saveError) setError(saveError)
  }

  async function onResendEmail(id: string) {
    setError(null)
    const { error: sendError } = await sendInviteEmail(id)
    if (sendError) setError(sendError)
  }

  async function onCopyLink(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current))
      }, 2000)
    } catch {
      setError('Could not copy invite link')
    }
  }

  return (
    <StepFrame>
      <StepHeader
        title="Invite team"
        description="Bring admins, coaches, or location viewers in now — or skip and invite them later from settings."
        optional
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Invite issue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {invites.length === 0 ? (
        <div className="rounded-xl bg-muted/40 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No teammates invited yet.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={addInviteDraft}
          >
            <Plus />
            Add teammate
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="space-y-4 rounded-xl bg-muted/40 p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={invite.email}
                    disabled={invite.saved}
                    onChange={(e) =>
                      updateInvite(invite.id, { email: e.target.value })
                    }
                    placeholder="teammate@company.com"
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel>Role</FieldLabel>
                  <Select
                    value={invite.role}
                    disabled={invite.saved}
                    onValueChange={(value) =>
                      updateInvite(invite.id, {
                        role: value as Exclude<OrgRole, 'owner'>,
                        assignedLocationId:
                          value === 'location_viewer'
                            ? invite.assignedLocationId
                            : null,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {invite.role === 'location_viewer' ? (
                <Field className="gap-1.5">
                  <FieldLabel>Assign location</FieldLabel>
                  <Select
                    value={invite.assignedLocationId ?? undefined}
                    disabled={invite.saved}
                    onValueChange={(value) =>
                      updateInvite(invite.id, {
                        assignedLocationId: value ?? null,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {invite.saved && invite.token ? (
                <Field className="gap-1.5">
                  <FieldLabel>Invite link</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteUrl(invite.token)}
                      className="font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void onCopyLink(invite.id, invite.token!)}
                    >
                      {copiedId === invite.id ? <Check /> : <Copy />}
                      {copiedId === invite.id ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      {invite.emailSent
                        ? `Email sent to ${invite.email}`
                        : `Invite saved for ${invite.email}`}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      loading={saving}
                      onClick={() => void onResendEmail(invite.id)}
                    >
                      <EnvelopeSimple />
                      {invite.emailSent ? 'Resend email' : 'Send email'}
                    </Button>
                  </div>
                </Field>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {invite.saved
                    ? invite.emailSent
                      ? 'Invite emailed'
                      : 'Invite ready'
                    : 'Not saved yet'}
                </p>
                <div className="flex gap-2">
                  {!invite.saved ? (
                    <Button
                      type="button"
                      size="sm"
                      loading={saving}
                      onClick={() => void onSaveInvite(invite.id)}
                    >
                      Save &amp; email invite
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeInvite(invite.id)}
                    aria-label="Remove invite"
                  >
                    <Trash />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="ghost" onClick={addInviteDraft}>
            <Plus />
            Add another
          </Button>
        </div>
      )}

      <StepFooter
        onBack={() => void setStep('scenario')}
        onContinue={() => void setStep('review')}
        secondaryAction={
          <Button
            type="button"
            variant="ghost"
            onClick={() => void setStep('review')}
          >
            Skip for now
          </Button>
        }
      />
    </StepFrame>
  )
}
