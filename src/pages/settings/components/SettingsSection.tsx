import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="surface-card divide-y divide-border-table overflow-hidden">
        {children}
      </div>
      {footer ? <div className="flex justify-end">{footer}</div> : null}
    </section>
  )
}

interface SettingsRowProps {
  label: string
  description?: string
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start sm:gap-8',
        className
      )}
    >
      <div className="space-y-1 pt-0.5">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
