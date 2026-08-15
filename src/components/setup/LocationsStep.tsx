import { useState } from 'react'
import { ArrowsLeftRight, Plus, Trash } from '@phosphor-icons/react'
import {
  ChoiceCard,
  StepFooter,
  StepFrame,
  StepHeader,
} from '@/components/setup/StepChrome'
import { FlaggedCombobox } from '@/components/locations/FlaggedCombobox'
import { LocationCsvImportPanel } from '@/components/locations/LocationCsvImportPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { useSetupStore } from '@/stores/setup-store'
import {
  CALL_FREQUENCIES,
  COUNTRIES,
  TIMEZONES,
} from '@/types/setup'
import type { LocationInput } from '@/types/location'

type EntryMode = 'choose' | 'manual' | 'csv'

const emptyForm = {
  name: '',
  phone: '',
  timezone: '',
  country: '',
  callFrequency: '',
}

export function LocationsStep() {
  const locations = useSetupStore((s) => s.locations)
  const addLocation = useSetupStore((s) => s.addLocation)
  const removeLocation = useSetupStore((s) => s.removeLocation)
  const importLocations = useSetupStore((s) => s.importLocations)
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)

  const [mode, setMode] = useState<EntryMode>(
    locations.length > 0 ? 'manual' : 'choose'
  )
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  async function onAddLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Location name is required')
      return
    }
    setFormError(null)
    await addLocation(form)
    setForm(emptyForm)
  }

  async function onCsvImport(rows: LocationInput[]) {
    setImportBusy(true)
    const { error } = await importLocations(rows)
    setImportBusy(false)
    if (error) return { error }
    setMode('manual')
    return { error: null }
  }

  return (
    <StepFrame>
      <StepHeader
        title="Add locations"
        description="GhostShopper needs at least one location to call. Add them manually or import a CSV."
      />

      {mode === 'choose' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            title="Add manually"
            description="Enter location details one at a time."
            onClick={() => setMode('manual')}
          />
          <ChoiceCard
            title="Import CSV"
            description="Upload a spreadsheet and map the columns."
            onClick={() => setMode('csv')}
          />
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Manual entry</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode('choose')}
            >
              <ArrowsLeftRight />
              Change method
            </Button>
          </div>

          <form
            onSubmit={onAddLocation}
            className="space-y-4 rounded-xl border border-border p-5"
          >
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Check the form</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="locName">Location name</FieldLabel>
                <Input
                  id="locName"
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  placeholder="Downtown Clinic"
                  required
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="locPhone">Phone number</FieldLabel>
                <Input
                  id="locPhone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+1 555 0100"
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel>Call frequency</FieldLabel>
                <Combobox
                  items={[...CALL_FREQUENCIES]}
                  value={form.callFrequency || null}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      callFrequency: value ?? '',
                    }))
                  }
                >
                  <ComboboxTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full justify-between font-normal"
                      />
                    }
                  >
                    <span
                      className={
                        form.callFrequency
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {form.callFrequency || 'Choose frequency'}
                    </span>
                  </ComboboxTrigger>
                  <ComboboxContent>
                    <ComboboxInput placeholder="Search…" showTrigger={false} />
                    <ComboboxEmpty>No frequencies found.</ComboboxEmpty>
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
              <FlaggedCombobox
                label="Timezone"
                items={TIMEZONES}
                value={form.timezone}
                placeholder="Choose timezone"
                emptyLabel="No timezones found."
                flagKind="timezone"
                onChange={(timezone) =>
                  setForm((current) => ({ ...current, timezone }))
                }
              />
              <FlaggedCombobox
                label="Country"
                items={COUNTRIES}
                value={form.country}
                placeholder="Choose country"
                emptyLabel="No countries found."
                flagKind="country"
                onChange={(country) =>
                  setForm((current) => ({ ...current, country }))
                }
              />
            </div>

            <Button type="submit" variant="secondary" loading={saving}>
              <Plus />
              Add location
            </Button>
          </form>
        </div>
      ) : null}

      {mode === 'csv' ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">CSV import</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode('choose')}
            >
              <ArrowsLeftRight />
              Change method
            </Button>
          </div>

          <LocationCsvImportPanel
            busy={importBusy}
            onImport={onCsvImport}
          />
        </div>
      ) : null}

      {locations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {locations.length} location{locations.length === 1 ? '' : 's'} added
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-muted/40">
            {locations.map((location) => (
              <li
                key={location.id}
                className="flex items-start justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{location.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      location.phone,
                      location.timezone,
                      location.country,
                      location.callFrequency,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Details incomplete'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void removeLocation(location.id)}
                  aria-label={`Remove ${location.name}`}
                >
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <StepFooter
        onBack={() => void setStep('welcome')}
        onContinue={() => void setStep('scorecard')}
        continueDisabled={locations.length === 0}
      />
    </StepFrame>
  )
}
