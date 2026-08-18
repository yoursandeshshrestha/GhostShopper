import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isOtherOptionComplete, splitOtherOption } from '@/lib/other-option'
import { cn } from '@/lib/utils'
import { INDUSTRIES } from '@/types/org'

export function IndustryField({
  id = 'industry',
  value,
  onChange,
  disabled,
  triggerClassName,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  triggerClassName?: string
}) {
  const { selectValue, customValue, showCustom } = splitOtherOption(
    INDUSTRIES,
    value
  )

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={selectValue || undefined}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === 'Other') {
            onChange(customValue || 'Other')
            return
          }
          onChange(next ?? '')
        }}
      >
        <SelectTrigger
          id={id}
          className={cn('h-9 w-full justify-between', triggerClassName)}
        >
          <SelectValue placeholder="Choose industry" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200]">
          {INDUSTRIES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCustom ? (
        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-custom`}>Industry name</FieldLabel>
          <Input
            id={`${id}-custom`}
            value={customValue}
            disabled={disabled}
            placeholder="Type your industry"
            onChange={(event) => {
              const next = event.target.value
              onChange(next.trim() ? next : 'Other')
            }}
          />
        </Field>
      ) : null}
    </div>
  )
}

export function isIndustryComplete(value: string) {
  return isOtherOptionComplete(value)
}
