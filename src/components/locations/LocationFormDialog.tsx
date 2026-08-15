import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CountryFlag, TimezoneFlag } from '@/lib/flags'
import { cn } from '@/lib/utils'
import {
  CALL_FREQUENCIES,
  COUNTRIES,
  TIMEZONES,
} from '@/types/setup'
import {
  EMPTY_LOCATION_INPUT,
  type LocationInput,
  type OrgLocation,
} from '@/types/location'

/** Matches Create-board modal field controls: transparent bg, shared focus ring. */
const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

function FlaggedSelect({
  label,
  items,
  value,
  placeholder,
  flagKind,
  onChange,
}: {
  label: string
  items: readonly string[]
  value: string
  placeholder: string
  flagKind?: 'timezone' | 'country'
  onChange: (value: string) => void
}) {
  return (
    <Field className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value || undefined}
        onValueChange={(next) => onChange(next ?? '')}
      >
        <SelectTrigger
          className={cn(
            fieldControlClassName,
            'justify-between gap-2 whitespace-nowrap dark:bg-transparent dark:hover:bg-transparent'
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="z-[200]">
          {items.map((item) => (
            <SelectItem key={item} value={item}>
              <span className="flex min-w-0 items-center gap-2">
                {flagKind === 'timezone' ? (
                  <TimezoneFlag
                    timezone={item}
                    className="pointer-events-none"
                  />
                ) : null}
                {flagKind === 'country' ? (
                  <CountryFlag country={item} className="pointer-events-none" />
                ) : null}
                <span className="truncate">{item}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function LocationFormDialog({
  open,
  location,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  location: OrgLocation | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: LocationInput) => Promise<string | null>
}) {
  const [form, setForm] = useState<LocationInput>(EMPTY_LOCATION_INPUT)
  const [formError, setFormError] = useState<string | null>(null)
  const isEdit = Boolean(location)

  useEffect(() => {
    if (!open) return
    setFormError(null)
    if (location) {
      setForm({
        name: location.name,
        phone: location.phone ?? '',
        timezone: location.timezone ?? '',
        country: location.country ?? '',
        callFrequency: location.callFrequency ?? '',
      })
      return
    }
    setForm(EMPTY_LOCATION_INPUT)
  }, [location, open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const error = await onSubmit(form)
    if (error) {
      setFormError(error)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-[2px]"
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden rounded-lg border border-border bg-background p-0 shadow-lg ring-0"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest('[data-slot="select-content"]')) {
            event.preventDefault()
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest('[data-slot="select-content"]')) {
            event.preventDefault()
          }
        }}
      >
        <div className="flex max-h-[calc(100svh-2rem)] min-h-0 flex-col">
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pr-12 text-left sm:text-left">
            <DialogTitle className="text-lg font-semibold leading-none">
              {isEdit ? 'Edit location' : 'Add location'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update how GhostShopper reaches this location.'
                : 'Add a location GhostShopper can mystery-shop.'}
            </DialogDescription>
          </DialogHeader>

          <form
            id="location-form"
            onSubmit={(event) => void handleSubmit(event)}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-2 sm:col-span-2">
                <FieldLabel htmlFor="location-name">Location name</FieldLabel>
                <Input
                  id="location-name"
                  className={fieldControlClassName}
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Downtown Clinic"
                  required
                />
              </Field>

              <Field className="gap-2">
                <FieldLabel htmlFor="location-phone">Phone number</FieldLabel>
                <Input
                  id="location-phone"
                  className={fieldControlClassName}
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

              <FlaggedSelect
                label="Call frequency"
                items={CALL_FREQUENCIES}
                value={form.callFrequency}
                placeholder="Choose frequency"
                onChange={(callFrequency) =>
                  setForm((current) => ({ ...current, callFrequency }))
                }
              />

              <FlaggedSelect
                label="Timezone"
                items={TIMEZONES}
                value={form.timezone}
                placeholder="Choose timezone"
                flagKind="timezone"
                onChange={(timezone) =>
                  setForm((current) => ({ ...current, timezone }))
                }
              />

              <FlaggedSelect
                label="Country"
                items={COUNTRIES}
                value={form.country}
                placeholder="Choose country"
                flagKind="country"
                onChange={(country) =>
                  setForm((current) => ({ ...current, country }))
                }
              />
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </form>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="location-form" loading={saving}>
              {isEdit ? 'Save changes' : 'Add location'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
