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
import { CountryFlag, TimezoneFlag } from '@/lib/flags'
import { splitOtherOption } from '@/lib/other-option'

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
  const { selectValue, customValue, showCustom } = splitOtherOption(items, value)
  const fieldId = label.toLowerCase().replace(/\s+/g, '-')

  return (
    <Field className="gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        items={[...items]}
        value={selectValue || null}
        onValueChange={(next) => {
          if (next === 'Other') {
            onChange(customValue || 'Other')
            return
          }
          onChange(next ?? '')
        }}
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
          <span className="flex min-w-0 items-center gap-2 overflow-hidden">
            {value && flagKind === 'timezone' ? (
              <TimezoneFlag timezone={value} />
            ) : null}
            {value && flagKind === 'country' ? (
              <CountryFlag country={value} />
            ) : null}
            <span
              className={
                value
                  ? 'min-w-0 truncate text-foreground'
                  : 'min-w-0 truncate text-muted-foreground'
              }
            >
              {selectValue || placeholder}
            </span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder="Search…" showTrigger={false} />
          <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                <span className="flex min-w-0 items-center gap-2 overflow-hidden">
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
                  <span className="min-w-0 truncate">{item}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {showCustom ? (
        <Input
          id={`${fieldId}-custom`}
          value={customValue}
          placeholder={`Type ${label.toLowerCase()}`}
          onChange={(event) => {
            const next = event.target.value
            onChange(next.trim() ? next : 'Other')
          }}
        />
      ) : null}
    </Field>
  )
}
