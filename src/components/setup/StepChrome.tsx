import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function StepHeader({
  title,
  description,
  optional,
}: {
  title: string
  description: string
  optional?: boolean
}) {
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {title}
        </h1>
        {optional ? (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            Optional
          </span>
        ) : null}
      </div>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </header>
  )
}

export function StepFooter({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  continueLoading,
  secondaryAction,
}: {
  onBack?: () => void
  onContinue?: () => void
  continueLabel?: string
  continueDisabled?: boolean
  continueLoading?: boolean
  secondaryAction?: ReactNode
}) {
  return (
    <footer className="sticky bottom-0 mt-auto ml-[calc(50%-50cqw)] w-[100cqw] border-t border-border bg-background/95 px-8 py-4 backdrop-blur sm:px-12 supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div>
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-2">
          {secondaryAction}
          {onContinue ? (
            <Button
              type="button"
              loading={continueLoading}
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export function StepFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-full flex-col gap-8', className)}>
      {children}
    </div>
  )
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3.5 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-transparent hover:bg-muted/50'
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
        {description}
      </p>
    </button>
  )
}
