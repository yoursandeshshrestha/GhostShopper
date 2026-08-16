import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { needsAttestation } from '@/components/auth/ProtectedRoute'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const industries = [
  'Dental',
  'Home care',
  'Estate agency',
  'Hospitality',
  'Retail',
  'Other',
] as const

type Path = 'choose' | 'create' | 'attest'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inviteToken = params.get('token')
  const {
    user,
    profile,
    organisation,
    createOrganisation,
    signAttestation,
    acceptInvitation,
    signOut,
  } = useAuth()

  const pendingAttestation = needsAttestation(profile, organisation)
  const [path, setPath] = useState<Path>(pendingAttestation ? 'attest' : 'choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgName, setOrgName] = useState(organisation?.name ?? '')
  const [industry, setIndustry] = useState('')
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ||
      profile?.fullName ||
      ''
  )
  const [signName, setSignName] = useState(
    profile?.fullName ||
      (user?.user_metadata?.full_name as string | undefined) ||
      ''
  )
  const [jobTitle, setJobTitle] = useState('')
  const [authority, setAuthority] = useState(false)

  useEffect(() => {
    if (pendingAttestation) {
      setPath('attest')
      if (organisation?.name) setOrgName(organisation.name)
      if (profile?.fullName) {
        setFullName(profile.fullName)
        setSignName((current) => current || profile.fullName || '')
      }
    }
  }, [pendingAttestation, organisation?.name, profile?.fullName])

  async function onCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const { error: createError } = await createOrganisation({
      name: orgName.trim(),
      industry,
      fullName: fullName.trim(),
    })

    setBusy(false)

    if (createError) {
      setError(createError)
      return
    }

    setSignName(fullName.trim())
    setPath('attest')
  }

  async function onAttest(e: React.FormEvent) {
    e.preventDefault()
    if (!authority || !signName.trim() || !jobTitle.trim()) return

    setBusy(true)
    setError(null)

    const { error: attestError } = await signAttestation({
      signedBy: signName.trim(),
      jobTitle: jobTitle.trim(),
    })

    setBusy(false)

    if (attestError) {
      setError(attestError)
      return
    }

    navigate('/setup', { replace: true })
  }

  async function onAcceptInvite() {
    if (!inviteToken) return
    setBusy(true)
    setError(null)

    const { error: acceptError } = await acceptInvitation({
      token: inviteToken,
      fullName: fullName.trim() || undefined,
    })

    setBusy(false)

    if (acceptError) {
      setError(acceptError)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthLayout
      topRight={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            void signOut().then(() => navigate('/login', { replace: true }))
          }
        >
          Log out
        </Button>
      }
    >      {path === 'choose' ? (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              Set up GhostShopper
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an organisation or join one with an invitation.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" className="border-destructive/30">
              <WarningCircle weight="fill" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setError(null)
              setPath('create')
            }}
          >
            Create organisation
          </Button>

          {inviteToken ? (
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <p className="text-sm text-muted-foreground">
                You have an invitation link. Join without entering organisation
                details.
              </p>
              <Field className="gap-2">
                <FieldLabel htmlFor="inviteFullName">Your name</FieldLabel>
                <Input
                  id="inviteFullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Taylor"
                />
              </Field>
              <Button
                type="button"
                loading={busy}
                className="w-full"
                onClick={onAcceptInvite}
              >
                {busy ? 'Joining…' : 'Join organisation'}
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              To join an existing organisation, open the invitation link from
              your email.
            </p>
          )}
        </div>
      ) : null}

      {path === 'create' ? (
        <form onSubmit={onCreateOrg} className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              Create organisation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You will be the owner of this organisation.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" className="border-destructive/30">
              <WarningCircle weight="fill" />
              <AlertTitle>Couldn’t create organisation</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Field className="gap-2">
            <FieldLabel htmlFor="fullName">Your name</FieldLabel>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Taylor"
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="orgName">Organisation name</FieldLabel>
            <Input
              id="orgName"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your brand"
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="industry">Industry</FieldLabel>
            <Combobox
              items={[...industries]}
              value={industry || null}
              onValueChange={(value) => setIndustry(value ?? '')}
            >
              <ComboboxTrigger
                render={
                  <Button
                    id="industry"
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between font-normal focus-visible:ring-0"
                  />
                }
              >
                <span
                  className={
                    industry
                      ? 'min-w-0 truncate text-foreground'
                      : 'min-w-0 truncate text-muted-foreground'
                  }
                >
                  {industry || 'Choose industry'}
                </span>
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput
                  placeholder="Search…"
                  showTrigger={false}
                  className="w-full"
                />
                <ComboboxEmpty>No industries found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setPath('choose')}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              loading={busy}
              disabled={
                busy || !fullName.trim() || !orgName.trim() || !industry
              }
            >
              {busy ? 'Creating…' : 'Continue'}
            </Button>
          </div>
        </form>
      ) : null}

      {path === 'attest' ? (
        <form onSubmit={onAttest} className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-xl font-medium tracking-tight text-foreground">
              Legal attestation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Authorise GhostShopper to place mystery-shop calls for{' '}
              <span className="font-medium text-foreground">
                {organisation?.name || orgName || 'your organisation'}
              </span>
              .
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" className="border-destructive/30">
              <WarningCircle weight="fill" />
              <AlertTitle>Couldn’t save attestation</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              By signing below, I confirm I am authorised to act for this
              organisation and that GhostShopper may place outbound AI
              mystery-shop calls to the locations I register.
            </p>
          </div>

          <Field className="gap-2">
            <FieldLabel htmlFor="signName">Full name</FieldLabel>
            <Input
              id="signName"
              required
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="jobTitle">Job title</FieldLabel>
            <Input
              id="jobTitle"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Owner / Operations director"
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="typedSignature">Typed signature</FieldLabel>
            <Input
              id="typedSignature"
              required
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              placeholder="Type your full name"
            />
          </Field>
          <Field orientation="horizontal" className="items-start gap-2">
            <Checkbox
              id="authority"
              checked={authority}
              onCheckedChange={(v) => setAuthority(v === true)}
              className="mt-0.5"
            />
            <FieldLabel htmlFor="authority" className="font-normal leading-snug">
              I authorise GhostShopper to call our locations.
            </FieldLabel>
          </Field>

          <Button
            type="submit"
            loading={busy}
            disabled={
              busy || !authority || !signName.trim() || !jobTitle.trim()
            }
            className="w-full"
          >
            {busy ? 'Saving…' : 'Sign and continue'}
          </Button>
        </form>
      ) : null}
    </AuthLayout>
  )
}
