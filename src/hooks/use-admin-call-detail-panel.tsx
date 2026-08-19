import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { DetailSlideOver } from '@/components/layout/DetailSlideOver'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { usePlatformCallDetail } from '@/hooks/use-platform'
import { CallReviewPanel } from '@/pages/review/components/CallReviewPanel'
import {
  computeWeightedScore,
  type CallCriterionScore,
} from '@/types/org'

const PANEL_ANIMATION_MS = 300

function buildDraftScores(
  call: { criterionScores: CallCriterionScore[] },
  criteria: { id: string; name: string; weight: number }[]
) {
  return criteria.map((criterion) => {
    const saved = call.criterionScores.find(
      (item) => item.criterionId === criterion.id
    )
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

export function useAdminCallDetailPanel() {
  const {
    loading: detailLoading,
    error: detailError,
    call,
    orgName,
    criteria,
    load: loadCallDetail,
    clear: clearCallDetail,
  } = usePlatformCallDetail()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMounted, setPanelMounted] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draftScores = useMemo(
    () => (call ? buildDraftScores(call, criteria) : []),
    [call, criteria]
  )

  const weightedPreview = useMemo(
    () => computeWeightedScore(draftScores),
    [draftScores]
  )

  const notes = call?.notes?.trim() || call?.coachingSummary?.trim() || ''

  const openCall = useCallback(
    (callId: string) => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      setSelectedId(callId)
      setPanelMounted(true)
      setPanelOpen(false)
      void loadCallDetail(callId)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPanelOpen(true))
      })
    },
    [loadCallDetail]
  )

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSelectedId(null)
      setPanelMounted(false)
      clearCallDetail()
      closeTimerRef.current = null
    }, PANEL_ANIMATION_MS)
  }, [clearCallDetail])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const panel = (
    <DetailSlideOver open={panelOpen} mounted={panelMounted}>
      {detailLoading && !call ? (
        <div className="flex h-full items-center justify-center bg-background">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      ) : detailError && !call ? (
        <div className="flex h-full flex-col bg-background p-4">
          <Alert variant="destructive">
            <WarningCircle weight="fill" />
            <AlertTitle>Could not load call</AlertTitle>
            <AlertDescription>{detailError}</AlertDescription>
          </Alert>
        </div>
      ) : call ? (
        <CallReviewPanel
          call={call}
          orgName={orgName}
          criteria={criteria}
          draftScores={draftScores}
          weightedPreview={weightedPreview}
          notes={notes}
          saving={false}
          canReview={false}
          canEndCall={false}
          showFailureDebug
          actionError={null}
          onNotesChange={() => undefined}
          onScoreChange={() => undefined}
          onSubmit={() => undefined}
          onClose={closePanel}
        />
      ) : null}
    </DetailSlideOver>
  )

  return {
    selectedCallId: selectedId,
    panelOpen,
    panelMounted,
    openCall,
    closePanel,
    panel,
  }
}
