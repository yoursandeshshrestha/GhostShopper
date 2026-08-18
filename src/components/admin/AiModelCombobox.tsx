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
import { Input } from '@/components/ui/input'
import {
  AI_MODEL_OPTIONS,
  aiModelLabel,
  isKnownAiModel,
} from '@/lib/ai-models'
import { splitOtherOption } from '@/lib/other-option'
import { cn } from '@/lib/utils'

const MODEL_ITEMS = [...AI_MODEL_OPTIONS.map((option) => option.id), 'Other'] as const

const fieldClassName = cn(
  'h-9 w-full max-w-md rounded-md border border-input bg-input/30 px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

function displayValue(value: string) {
  if (!value) return 'Choose a model'
  if (isKnownAiModel(value)) {
    return `${aiModelLabel(value)} (${value})`
  }
  return value
}

export function AiModelCombobox({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { selectValue, customValue, showCustom } = splitOtherOption(MODEL_ITEMS, value)

  return (
    <div className="space-y-3">
      <Combobox
        items={[...MODEL_ITEMS]}
        value={selectValue || null}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === 'Other') {
            onChange(customValue || 'Other')
            return
          }
          onChange(next ?? '')
        }}
      >
        <ComboboxTrigger
          id={id}
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-9 w-full max-w-md justify-between font-normal"
            />
          }
        >
          <span
            className={cn(
              'min-w-0 truncate',
              value ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {displayValue(value)}
          </span>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder="Search models…" showTrigger={false} />
          <ComboboxEmpty>No matching models</ComboboxEmpty>
          <ComboboxList>
            {(item) =>
              item === 'Other' ? (
                <ComboboxItem key={item} value={item}>
                  Custom OpenRouter model…
                </ComboboxItem>
              ) : (
                <ComboboxItem key={item} value={item}>
                  <span className="flex min-w-0 flex-col items-start gap-0.5 overflow-hidden">
                    <span className="truncate">{aiModelLabel(item)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item}
                    </span>
                  </span>
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {showCustom ? (
        <Input
          id={`${id}-custom`}
          className={fieldClassName}
          value={customValue}
          disabled={disabled}
          placeholder="provider/model-id"
          onChange={(event) => {
            const next = event.target.value
            onChange(next.trim() ? next : 'Other')
          }}
        />
      ) : isKnownAiModel(value) ? (
        <p className="text-xs text-muted-foreground">
          {AI_MODEL_OPTIONS.find((option) => option.id === value)?.description}
        </p>
      ) : null}
    </div>
  )
}
