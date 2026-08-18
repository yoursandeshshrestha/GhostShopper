import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import {
  DetailSlideOver,
  detailPanelPaddingClass,
} from '@/components/layout/DetailSlideOver'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import { Spinner } from '@/components/ui/spinner'
import {
  usePlatformCallDetail,
  usePlatformCalls,
} from '@/hooks/use-platform'
import { formatDateTimeShort } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { CallReviewPanel } from '@/pages/review/components/CallReviewPanel'
import {
  CALL_STATUS_LABELS,
  callStatusVariant,
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

export function AdminCallsPage() {
  const { loading, loadingMore, error, calls, totalCount, hasMore, loadMore } =
    usePlatformCalls()
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

  const notes =
    call?.notes?.trim() || call?.coachingSummary?.trim() || ''

  const openPanel = useCallback(
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

  return (
    <>
      <AppPage
        title="Calls"
        count={totalCount || undefined}
        loading={loading}
        className={cn(
          'relative transition-[padding] duration-300 ease-in-out',
          detailPanelPaddingClass(panelOpen && panelMounted)
        )}
      >
        {error ? (
          <PageEmptyState title="Could not load calls" description={error} />
        ) : calls.length === 0 ? (
          <PageEmptyState
            title="No calls"
            description="Mystery-shop calls from every organisation show up here."
          />
        ) : (
          <SurfaceCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Organisation</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((row) => {
                  const isSelected = selectedId === row.id
                  return (
                    <TableRow
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openPanel(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openPanel(row.id)
                        }
                      }}
                      className={cn(
                        'cursor-pointer transition-colors',
                        'focus-visible:outline-none',
                        isSelected && 'bg-surface-hover/40'
                      )}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to={`/admin/organisations/${row.orgId}`}
                          className="hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.orgName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.locationName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={callStatusVariant(row.status)}>
                            {CALL_STATUS_LABELS[row.status]}
                          </Badge>
                          {row.flaggedForReview ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Flagged
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.score == null ? '—' : row.score}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTimeShort(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <LoadMoreButton
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          </SurfaceCard>
        )}
      </AppPage>

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
            actionError={null}
            onNotesChange={() => undefined}
            onScoreChange={() => undefined}
            onSubmit={() => undefined}
            onClose={closePanel}
          />
        ) : null}
      </DetailSlideOver>
    </>
  )
}
