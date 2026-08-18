import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardText,
  PhoneOutgoing,
  WarningCircle,
} from '@phosphor-icons/react'
import { AppPage } from '@/components/layout/AppPage'
import { useNewCall } from '@/components/calls/NewCallProvider'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  DetailSlideOver,
  detailPanelPaddingClass,
} from '@/components/layout/DetailSlideOver'
import { useCalls } from '@/hooks/use-calls'
import {
  computeWeightedScore,
  type CallCriterionScore,
  type OrgCall,
} from '@/types/org'
import type { ScorecardCriterion } from '@/types/setup'
import { cn } from '@/lib/utils'
import { CallsExportMenu } from './components/CallsExportMenu'
import { CallReviewPanel } from './components/CallReviewPanel'
import { CallsTable } from './components/CallsTable'

const PANEL_ANIMATION_MS = 300

function buildDraftScores(
  criteria: ScorecardCriterion[],
  existing: CallCriterionScore[]
) {
  return criteria.map((criterion) => {
    const saved = existing.find((item) => item.criterionId === criterion.id)
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weight: criterion.weight,
      score: saved?.score ?? 0,
      confidence: saved?.confidence,
      evidenceQuote: saved?.evidenceQuote,
      transcriptOffset: saved?.transcriptOffset,
      source: saved?.source,
    }
  })
}

export function ReviewPage() {
  const { openNewCall } = useNewCall()
  const {
    loading,
    loadingMore,
    syncing,
    saving,
    ending,
    error,
    canReview,
    canCreate,
    calls,
    totalCount,
    hasMore,
    loadMore,
    getCriteriaForCall,
    updateCallReview,
    endCall,
    refresh,
  } = useCalls()

  const [selected, setSelected] = useState<OrgCall | null>(null)
  const criteria = useMemo(
    () => getCriteriaForCall(selected),
    [getCriteriaForCall, selected]
  )

  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMounted, setPanelMounted] = useState(false)
  const [draftScores, setDraftScores] = useState<CallCriterionScore[]>([])
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const awaiting = useMemo(
    () => calls.filter((call) => call.status === 'awaiting_review'),
    [calls]
  )

  const hasLiveCalls = useMemo(
    () =>
      calls.some(
        (call) => call.status === 'in_progress' || call.status === 'queued'
      ),
    [calls]
  )

  const hasAnalysing = useMemo(
    () => calls.some((call) => call.status === 'analysing'),
    [calls]
  )

  useEffect(() => {
    if (!selected) return
    const latest = calls.find((call) => call.id === selected.id)
    if (latest) setSelected(latest)
  }, [calls, selected?.id])

  const weightedPreview = useMemo(
    () => computeWeightedScore(draftScores),
    [draftScores]
  )

  const openPanel = useCallback((call: OrgCall) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    setSelected(call)
    setPanelMounted(true)
    setPanelOpen(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelOpen(true))
    })
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSelected(null)
      setPanelMounted(false)
      closeTimerRef.current = null
    }, PANEL_ANIMATION_MS)
  }, [])

  useEffect(() => {
    if (!selected) return
    setDraftScores(buildDraftScores(criteria, selected.criterionScores))
    setNotes(
      selected.notes?.trim() || selected.coachingSummary?.trim() || ''
    )
    setActionError(null)
  }, [criteria, selected])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  async function onSubmitReview() {
    if (!selected) return
    if (draftScores.length === 0) {
      setActionError('Configure scorecard criteria before reviewing calls.')
      return
    }

    setActionError(null)
    const result = await updateCallReview(selected.id, {
      criterionScores: draftScores,
      notes,
      coachingSummary: notes.trim() || null,
      status: 'completed',
    })
    if (result.error) {
      setActionError(result.error)
      return
    }
    closePanel()
  }

  async function onEndCall() {
    if (!selected) return
    setActionError(null)
    const result = await endCall(selected.id)
    if (result.error) {
      setActionError(result.error)
    }
  }

  function onScoreChange(criterionId: string, score: number) {
    setDraftScores((current) =>
      current.map((row) =>
        row.criterionId === criterionId
          ? { ...row, score, source: 'human' as const }
          : row
      )
    )
  }

  return (
    <>
      <AppPage
        title="Review"
        count={totalCount > 0 ? totalCount : undefined}
        loading={loading}
        className={cn(
          'relative transition-[padding] duration-300 ease-in-out',
          detailPanelPaddingClass(panelOpen && panelMounted)
        )}
        actions={
          <>
            <CallsExportMenu calls={calls} />
            {awaiting.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {awaiting.length} need review
              </span>
            ) : null}
            {hasLiveCalls ? (
              <span className="text-xs text-muted-foreground">
                Call in progress
              </span>
            ) : null}
            {hasAnalysing ? (
              <span className="text-xs text-muted-foreground">
                AI is analysing
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={loading || syncing}
              onClick={() => void refresh({ sync: true })}
            >
              Sync
            </Button>
            <Button type="button" size="sm" onClick={openNewCall}>
              <PhoneOutgoing />
              New call
            </Button>
          </>
        }
      >
        {error || actionError ? (
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{actionError || error}</AlertDescription>
          </Alert>
        ) : null}

        {calls.length === 0 ? (
          <Empty className="layout__layer border border-dashed border-border-subtle">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardText />
              </EmptyMedia>
              <EmptyTitle>No calls yet</EmptyTitle>
              <EmptyDescription>
                Start a mystery-shop call. Every scored call waits here for
                coach notes before it is complete. Flagged calls are emailed
                to owners, admins, and coaches.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={openNewCall}>
                <PhoneOutgoing />
                New call
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <CallsTable
              calls={calls}
              selectedId={selected?.id ?? null}
              onSelect={openPanel}
            />
            <LoadMoreButton
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          </>
        )}
      </AppPage>

      <DetailSlideOver open={panelOpen} mounted={panelMounted}>
        {selected ? (
          <CallReviewPanel
            call={selected}
            criteria={criteria}
            draftScores={draftScores}
            weightedPreview={weightedPreview}
            notes={notes}
            saving={saving}
            ending={ending}
            canReview={canReview}
            canEndCall={canCreate}
            actionError={actionError}
            onNotesChange={setNotes}
            onScoreChange={onScoreChange}
            onSubmit={() => void onSubmitReview()}
            onEndCall={() => void onEndCall()}
            onClose={closePanel}
          />
        ) : null}
      </DetailSlideOver>
    </>
  )
}
