import { Link } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { CallCriterionScore } from '@/types/org'
import type { ScorecardCriterion } from '@/types/setup'
import { cn } from '@/lib/utils'

const CONFIDENCE_REVIEW_THRESHOLD = 0.7

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

function formatOffset(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return null
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

interface ScorecardReviewFormProps {
  criteria: ScorecardCriterion[]
  draftScores: CallCriterionScore[]
  weightedPreview: number | null
  disabled: boolean
  onChangeScore: (criterionId: string, score: number) => void
}

export function ScorecardReviewForm({
  criteria,
  draftScores,
  weightedPreview,
  disabled,
  onChangeScore,
}: ScorecardReviewFormProps) {
  if (criteria.length === 0) {
    return (
      <div className="border-t border-border-table px-4 py-3">
        <Alert>
          <WarningCircle />
          <AlertTitle>No scorecard criteria</AlertTitle>
          <AlertDescription>
            Add criteria on the{' '}
            <Link to="/scorecard" className="underline underline-offset-2">
              Scorecard
            </Link>{' '}
            page before calls can be graded.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="border-t border-border-table">
      <div className="flex items-center justify-between border-b border-border-table px-4 py-2">
        <span className="text-sm font-medium text-foreground">Scorecard</span>
        <Badge variant="secondary" className="tabular-nums">
          Total {weightedPreview == null ? '—' : weightedPreview}
        </Badge>
      </div>
      <div className="divide-y divide-border-table">
        {draftScores.map((item) => {
          const lowConfidence =
            item.confidence != null &&
            item.confidence < CONFIDENCE_REVIEW_THRESHOLD
          const offsetLabel = formatOffset(item.transcriptOffset)

          return (
            <div key={item.criterionId} className="px-4 py-2.5">
              <div className="grid grid-cols-[1fr_88px] items-start gap-3 sm:grid-cols-[1fr_88px_56px]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {item.criterionName}
                    </p>
                    {item.source === 'ai' ? (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        AI
                      </Badge>
                    ) : null}
                    {lowConfidence ? (
                      <Badge variant="destructive" className="h-5 text-[10px]">
                        Low confidence
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.weight}% weight
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className={fieldControlClassName}
                  value={item.score}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    onChangeScore(
                      item.criterionId,
                      Number.isNaN(next) ? 0 : next
                    )
                  }}
                />
                <p className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                  {item.weight}%
                </p>
              </div>
              {item.evidenceQuote ? (
                <blockquote className="mt-2 border-l-2 border-border-subtle pl-3 text-xs leading-relaxed text-muted-foreground">
                  {item.evidenceQuote}
                  {offsetLabel ? (
                    <span className="mt-1 block tabular-nums text-foreground/70">
                      at {offsetLabel}
                    </span>
                  ) : null}
                </blockquote>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
