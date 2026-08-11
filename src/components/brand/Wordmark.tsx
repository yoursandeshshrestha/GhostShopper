import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface WordmarkProps {
  className?: string
  to?: string
}

export function Wordmark({ className, to = '/' }: WordmarkProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-baseline gap-0.5 text-base font-medium tracking-tight text-foreground',
        className
      )}
    >
      ghostshopper
      <span className="text-muted-foreground">.ai</span>
    </Link>
  )
}
