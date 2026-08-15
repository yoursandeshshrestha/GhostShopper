import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMainScrollContainer } from '@/contexts/MainScrollContext'
import { cn } from '@/lib/utils'

interface ContentSectionProps {
  children: ReactNode
  className?: string
}

export function ContentSection({ children, className }: ContentSectionProps) {
  return (
    <div
      className={cn(
        'content-section content-section--full p-4 sm:p-6 lg:p-10',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ContentSectionHeaderProps {
  children: ReactNode
  className?: string
}

export function ContentSectionHeader({
  children,
  className,
}: ContentSectionHeaderProps) {
  const scrollRef = useMainScrollContainer()
  const headerRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const header = headerRef.current
    const root =
      scrollRef?.current ??
      document.querySelector<HTMLElement>('[data-main-scroll]')
    if (!header || !root) return

    const update = () => {
      const rootTop = root.getBoundingClientRect().top
      const headerTop = header.getBoundingClientRect().top
      setIsStuck(headerTop <= rootTop + 10)
    }

    root.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(root)

    return () => {
      root.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      resizeObserver.disconnect()
    }
  }, [scrollRef])

  return (
    <div
      ref={headerRef}
      className={cn(
        'content-section__header',
        isStuck && 'content-section__header--stuck',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ContentSectionContentProps {
  children: ReactNode
  className?: string
}

export function ContentSectionContent({
  children,
  className,
}: ContentSectionContentProps) {
  return (
    <div className={cn('content-section__content w-full', className)}>
      {children}
    </div>
  )
}
