import { EnvelopeSimple, Lifebuoy } from '@phosphor-icons/react'
import { AppPage, SurfacePanel } from '@/components/layout/AppPage'
import { Button } from '@/components/ui/button'

const faqs = [
  {
    q: 'How do mystery-shop calls get scored?',
    a: 'Scores attach to locations using your scorecard criteria — never to named staff.',
  },
  {
    q: 'Who can invite teammates?',
    a: 'Owners and admins can invite admins, coaches, and location viewers from Settings.',
  },
  {
    q: 'Where do I change the AI customer?',
    a: 'Use the Agent page to edit persona, goals, and conversation rules, then save & approve.',
  },
]

export function SupportPage() {
  return (
    <AppPage
      title="Support"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SurfacePanel>
          <div className="flex items-start gap-3">
            <Lifebuoy className="mt-0.5 size-5 shrink-0 text-foreground" />
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Contact support
                </p>
                <p className="text-sm text-muted-foreground">
                  Email us and we’ll help with setup, billing, or call issues.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="mailto:hello@ghostshopper.ai">
                  <EnvelopeSimple />
                  hello@ghostshopper.ai
                </a>
              </Button>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel>
          <p className="text-sm font-medium text-foreground">FAQs</p>
          <div className="mt-4 space-y-4">
            {faqs.map((item) => (
              <div key={item.q}>
                <p className="text-sm font-medium text-foreground">{item.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </SurfacePanel>
      </div>
    </AppPage>
  )
}
