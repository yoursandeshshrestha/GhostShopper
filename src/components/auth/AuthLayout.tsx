import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: ReactNode
  bottomLeft?: ReactNode
}

export function AuthLayout({ children, bottomLeft }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background px-5 py-10 text-foreground">
      <Link
        to="/login"
        className="absolute top-5 left-5 text-base font-medium tracking-tight text-foreground"
      >
        ghostshopper
        <span className="text-muted-foreground">.ai</span>
      </Link>

      <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>

      {bottomLeft ? (
        <div className="absolute bottom-8 left-5 z-10">{bottomLeft}</div>
      ) : null}

      <p className="absolute right-0 bottom-8 left-0 text-center text-xs text-muted-foreground">
        Every location. Every week. Scored.
      </p>
    </main>
  )
}
