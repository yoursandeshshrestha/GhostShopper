import { Button } from '@/components/ui/button'
import { useSetupStore } from '@/stores/setup-store'

export function WelcomeStep() {
  const setStep = useSetupStore((s) => s.setStep)
  const saving = useSetupStore((s) => s.saving)

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8 text-left">
        <div className="space-y-3">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Welcome to GhostShopper
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Let’s configure your organization so mystery-shop calls can start.
            This usually takes about 5 minutes — you can leave and continue
            anytime.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Add the locations you want called</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Choose how staff conversations are scored</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span>Approve an AI customer scenario</span>
          </li>
        </ul>

        <Button
          type="button"
          className="w-full"
          loading={saving}
          onClick={() => void setStep('locations')}
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}
