import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  to?: string
  variant?: 'full' | 'icon'
}

export function Logo({ className, to = '/', variant = 'full' }: LogoProps) {
  const isIcon = variant === 'icon'
  const imageClass = cn(
    'block bg-transparent object-contain',
    isIcon ? 'h-7 w-7' : 'h-6 w-auto max-w-[min(100%,11.5rem)] sm:h-7'
  )

  const content = (
    <>
      <img
        src={isIcon ? '/brand/icon-on-dark.svg' : '/brand/logo-on-dark.svg'}
        alt="ghostshopper.ai"
        className={cn(imageClass, 'hidden dark:block')}
      />
      <img
        src={isIcon ? '/brand/icon-on-light.svg' : '/brand/logo-on-light.svg'}
        alt="ghostshopper.ai"
        className={cn(imageClass, 'dark:hidden')}
      />
    </>
  )

  if (to) {
    return (
      <Link to={to} className={cn('inline-flex shrink-0 items-center', className)}>
        {content}
      </Link>
    )
  }

  return <span className={cn('inline-flex shrink-0 items-center', className)}>{content}</span>
}
