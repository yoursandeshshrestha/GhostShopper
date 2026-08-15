import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ResourceCardProps {
  to: string
  title: string
  description?: string
  meta?: ReactNode
  badges?: ReactNode
  className?: string
}

export function ResourceCard({
  to,
  title,
  description,
  meta,
  badges,
  className,
}: ResourceCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'surface-card group flex flex-col gap-3 p-5 transition-colors',
        'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <CaretRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      {badges || meta ? (
        <div className="flex flex-wrap items-center gap-2">
          {badges}
          {meta ? (
            <span className="ml-auto text-xs text-muted-foreground">{meta}</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}
