import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  headerExtra?: ReactNode
}

export function ChartCard({
  title,
  description,
  children,
  className,
  headerExtra,
}: ChartCardProps) {
  return (
    <div className={cn('surface-card p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {headerExtra}
      </div>
      {children}
    </div>
  )
}
