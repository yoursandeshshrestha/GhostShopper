import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Check } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import { Button } from '@/components/ui/button'
import { useSetupStore } from '@/stores/setup-store'
import {
  SETUP_STEP_LABELS,
  SETUP_STEPS,
  type SetupStep,
} from '@/types/setup'
import { cn } from '@/lib/utils'

interface SetupWizardLayoutProps {
  children: ReactNode
  step: SetupStep
  progress: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  orgName?: string
}

export function SetupWizardLayout({
  children,
  step,
  progress,
  orgName,
}: SetupWizardLayoutProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const setStep = useSetupStore((s) => s.setStep)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const currentIndex = SETUP_STEPS.indexOf(step)

  async function onLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-svh bg-background text-foreground">
      <aside className="flex w-[30%] min-w-[240px] max-w-[320px] flex-col border-r border-border px-7 py-7">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-base font-medium tracking-tight">
                ghostshopper
                <span className="text-muted-foreground">.ai</span>
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {orgName || 'Organization setup'}
              </p>
            </div>

            <div
              className="relative size-11 shrink-0"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progress}% complete`}
            >
              <svg className="size-11 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  pathLength="100"
                  className="stroke-secondary"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  pathLength="100"
                  className="stroke-primary transition-all duration-300"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress} 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums text-foreground">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex-1">
          <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Setup
          </p>

          <nav className="flex flex-col">
            {SETUP_STEPS.map((item, index) => {
              const done = index < currentIndex
              const active = item === step
              const reachable = index <= currentIndex
              const isLast = index === SETUP_STEPS.length - 1

              return (
                <div key={item} className="flex gap-3">
                  <div className="flex w-6 shrink-0 flex-col items-center self-stretch">
                    <span
                      className={cn(
                        'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                        done && 'bg-primary text-primary-foreground',
                        active &&
                          !done &&
                          'bg-primary text-primary-foreground ring-4 ring-primary/20',
                        !active &&
                          !done &&
                          'border border-border bg-background text-muted-foreground'
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" weight="bold" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    {!isLast ? (
                      <span
                        className={cn(
                          'mt-1.5 w-px flex-1',
                          done ? 'bg-primary/60' : 'bg-border'
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => {
                      if (reachable && item !== step) void setStep(item)
                    }}
                    className={cn(
                      'mb-5 flex min-h-6 flex-1 items-center py-0.5 text-left transition-colors',
                      isLast && 'mb-0',
                      reachable && !active && 'hover:opacity-90',
                      !reachable && 'cursor-not-allowed opacity-45'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm',
                        active
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {SETUP_STEP_LABELS[item]}
                    </span>
                  </button>
                </div>
              )
            })}
          </nav>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-auto w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => setLogoutOpen(true)}
        >
          Log out
        </Button>
      </aside>

      <section className="@container/setup flex w-[70%] flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 pt-10 pb-0 sm:px-12">
          {children}
        </div>
      </section>
      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={onLogout}
      />
    </main>
  )
}
