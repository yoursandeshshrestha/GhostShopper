import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import {
  ContentSection,
  ContentSectionContent,
  ContentSectionHeader,
} from '@/components/layout/ContentSection'
import { PageLoading } from '@/components/layout/PageLoading'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  count?: number | string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}

export function PageHeader({
  title,
  count,
  actions,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <ContentSectionHeader>
      <div className="content-section__header-inner">
        <div className="flex min-w-0 items-center gap-2">
          {backHref ? (
            <Link
              to={backHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only sm:not-sr-only">{backLabel}</span>
            </Link>
          ) : null}
          <h1 className="text-base font-normal">{title}</h1>
          {count != null ? (
            <span className="text-sm text-muted-foreground">({count})</span>
          ) : null}
        </div>
        {actions ? (
          <>
            <div className="content-section__divider" />
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          </>
        ) : null}
      </div>
    </ContentSectionHeader>
  )
}

interface AppPageProps {
  title: string
  count?: number | string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  loading?: boolean
  className?: string
  contentClassName?: string
  children: ReactNode
}

export function AppPage({
  title,
  count,
  actions,
  backHref,
  backLabel,
  loading = false,
  className,
  contentClassName,
  children,
}: AppPageProps) {
  return (
    <ContentSection className={className}>
      <PageHeader
        title={title}
        count={count}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
      />
      <ContentSectionContent
        className={cn('space-y-4 pt-4', contentClassName)}
      >
        {loading ? <PageLoading /> : children}
      </ContentSectionContent>
    </ContentSection>
  )
}

export function SurfaceCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('surface-card overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function SurfacePanel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('surface-card p-6', className)}>{children}</div>
  )
}
