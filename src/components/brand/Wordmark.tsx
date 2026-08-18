import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

interface WordmarkProps {
  className?: string
  to?: string
}

export function Wordmark({ className, to = '/' }: WordmarkProps) {
  return <Logo className={cn(className)} to={to} variant="full" />
}
