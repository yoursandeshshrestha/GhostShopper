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
import { CountryFlag, TimezoneFlag } from '@/lib/flags'

export function FlaggedCombobox({
  label,
  items,
  value,
  placeholder,
  emptyLabel,
  flagKind,
  onChange,
}: {
  label: string
  items: readonly string[]
  value: string
  placeholder: string
  emptyLabel: string
  flagKind?: 'timezone' | 'country'
  onChange: (value: string) => void
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        items={[...items]}
        value={value || null}
        onValueChange={(next) => onChange(next ?? '')}
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
          <span className="flex min-w-0 items-center gap-2">
            {value && flagKind === 'timezone' ? (
              <TimezoneFlag timezone={value} />
            ) : null}
            {value && flagKind === 'country' ? (
              <CountryFlag country={value} />
            ) : null}
            <span
              className={
                value
                  ? 'truncate text-foreground'
                  : 'truncate text-muted-foreground'
              }
            >
              {value || placeholder}
            </span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder="Search…" showTrigger={false} />
          <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                <span className="flex min-w-0 items-center gap-2">
                  {flagKind === 'timezone' ? (
                    <TimezoneFlag
                      timezone={item}
                      className="pointer-events-none"
                    />
                  ) : null}
                  {flagKind === 'country' ? (
                    <CountryFlag
                      country={item}
                      className="pointer-events-none"
                    />
                  ) : null}
                  <span className="truncate">{item}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
