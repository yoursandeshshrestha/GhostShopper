import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type PageLoadingVariant = 'content' | 'compact' | 'overlay' | 'full'

interface PageLoadingProps {
  className?: string
  variant?: PageLoadingVariant
  size?: 'sm' | 'md'
}

export function PageLoading({
  className,
  variant = 'content',
  size,
}: PageLoadingProps) {
  const spinnerSize = size ?? (variant === 'compact' ? 'sm' : 'md')

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        variant === 'content' && 'min-h-[400px]',
        variant === 'compact' && 'py-12',
        variant === 'overlay' && 'absolute inset-0 z-50 bg-background',
        variant === 'full' && 'h-screen',
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <Spinner size={spinnerSize} className="text-muted-foreground" />
    </div>
  )
}
