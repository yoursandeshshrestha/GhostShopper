import { useMemo } from 'react'
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
import { useOpenRouterModels } from '@/hooks/use-openrouter-models'
import { splitOtherOption } from '@/lib/other-option'
import { cn } from '@/lib/utils'

const fieldClassName = cn(
  'h-9 w-full max-w-md rounded-md border border-input bg-input/30 px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

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
  const { loading, error, models } = useOpenRouterModels()
  const byId = useMemo(
    () => new Map(models.map((model) => [model.id, model])),
    [models]
  )
  const items = useMemo(() => [...models.map((model) => model.id), 'Other'], [models])
  const { selectValue, customValue, showCustom } = splitOtherOption(items, value)
  const selected = byId.get(value)

  function displayValue() {
    if (loading && models.length === 0) return 'Loading models…'
    if (!value) return 'Choose a model'
    if (selected) return `${selected.name} (${selected.id})`
    return value
  }

  return (
    <div className="space-y-3">
      <Combobox
        items={items}
        value={selectValue || null}
        disabled={disabled || (loading && models.length === 0)}
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
          disabled={disabled || (loading && models.length === 0)}
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled || (loading && models.length === 0)}
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
            {displayValue()}
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="max-w-md">
          <ComboboxInput placeholder="Search models…" showTrigger={false} />
          <ComboboxEmpty>
            {error ? 'Could not load OpenRouter models' : 'No matching models'}
          </ComboboxEmpty>
          <ComboboxList className="max-h-80">
            {(item) =>
              item === 'Other' ? (
                <ComboboxItem key={item} value={item}>
                  Custom OpenRouter model…
                </ComboboxItem>
              ) : (
                <ComboboxItem key={item} value={item}>
                  <span className="flex min-w-0 flex-col items-start gap-0.5 overflow-hidden">
                    <span className="truncate">{byId.get(item)?.name ?? item}</span>
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

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : showCustom ? (
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
      ) : selected?.description ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {selected.description}
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading OpenRouter catalog…</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {models.length.toLocaleString()} models from OpenRouter
        </p>
      )}
    </div>
  )
}
