import { PhoneX, X } from '@phosphor-icons/react'
import { InfoLine } from '@/components/layout/InfoLine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/datetime'
import {
  CALL_STATUS_LABELS,
  callStatusVariant,
  formatFlagReason,
  flagReasonVariant,
  type CallCriterionScore,
  type OrgCall,
} from '@/types/org'
import type { ScorecardCriterion } from '@/types/setup'
import { cn } from '@/lib/utils'
import { useCallRecordingPlayer } from '@/hooks/use-call-recording-player'
import { CallTranscript } from './CallTranscript'
import { CallRecordingActions } from './CallRecordingActions'
import { CallRecordingDock } from './CallRecordingDock'
import { ScorecardReviewForm } from './ScorecardReviewForm'

const fieldControlClassName = cn(
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

interface CallReviewPanelProps {
  call: OrgCall
  criteria: ScorecardCriterion[]
  draftScores: CallCriterionScore[]
  weightedPreview: number | null
  notes: string
  saving: boolean
  ending?: boolean
  canReview: boolean
  canEndCall?: boolean
  actionError: string | null
  onNotesChange: (value: string) => void
  onScoreChange: (criterionId: string, score: number) => void
  onSubmit: () => void
  onEndCall?: () => void
  onClose: () => void
}

function CallAiSummary({ call }: { call: OrgCall }) {
  if (!call.callSummary) return null

  return (
    <div className="border-t border-border-table">
      <div className="border-b border-border-table px-4 py-2">
        <span className="text-sm font-medium text-foreground">AI summary</span>
      </div>
      <div className="space-y-4 px-4 py-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What happened
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {call.callSummary}
          </p>
        </div>
      </div>
    </div>
  )
}

export function CallReviewPanel({
  call,
  criteria,
  draftScores,
  weightedPreview,
  notes,
  saving,
  ending = false,
  canReview,
  canEndCall = false,
  actionError,
  onNotesChange,
  onScoreChange,
  onSubmit,
  onEndCall,
  onClose,
}: CallReviewPanelProps) {
  const isAwaiting = call.status === 'awaiting_review'
  const isAnalysing = call.status === 'analysing'
  const isActive = call.status === 'queued' || call.status === 'in_progress'
  const isTerminal = !isActive && !isAwaiting && !isAnalysing
  const hasAiScores = call.criterionScores.some((item) => item.source === 'ai')
  const hasScores = call.criterionScores.length > 0 || call.score != null

  const {
    src: recordingSrc,
    loading: recordingLoading,
    error: recordingError,
    isPreviewOpen,
    isPlaying,
    isDownloading,
    stopRecording,
    closePreview,
    openPreview,
    togglePlayPause,
    play,
    handlePlaybackEnd,
    handleWaveSurferReady,
    handleWaveSurferDestroy,
    downloadRecording,
  } = useCallRecordingPlayer({
    callId: call.id,
    recordingPath: call.recordingUrl,
  })

  const handleClose = () => {
    stopRecording()
    closePreview()
    onClose()
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-table px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Call details</h2>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close call details"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="shrink-0 space-y-1 border-b border-border-table px-4 py-3">
        <p className="text-base font-semibold text-foreground">
          {formatDateTime(call.createdAt)}
        </p>

        <InfoLine label="Location">{call.locationName}</InfoLine>

        <InfoLine label="Status">
          <Badge variant={callStatusVariant(call.status)} className="h-5">
            {CALL_STATUS_LABELS[call.status]}
          </Badge>
        </InfoLine>

        {call.score != null ? (
          <InfoLine label="Score">
            <span className="tabular-nums text-foreground">{call.score}</span>
          </InfoLine>
        ) : null}

        {call.graderModel ? (
          <InfoLine label="Graded by">
            <span className="text-muted-foreground">{call.graderModel}</span>
          </InfoLine>
        ) : null}

        {call.completedAt ? (
          <InfoLine label="Completed">
            {formatDateTime(call.completedAt)}
          </InfoLine>
        ) : null}

        {call.failureReason ? (
          <InfoLine label="Details">
            <span className="text-destructive">{call.failureReason}</span>
          </InfoLine>
        ) : null}

        {call.suspectedAi ? (
          <InfoLine label="Flag">
            <Badge variant="destructive" className="h-5 text-[11px]">
              Suspected AI detection
            </Badge>
          </InfoLine>
        ) : null}

        <CallRecordingActions
          hasRecording={Boolean(call.recordingUrl)}
          loading={recordingLoading}
          error={recordingError}
          playbackReady={Boolean(recordingSrc)}
          isDownloading={isDownloading}
          onPlay={openPreview}
          onDownload={() => void downloadRecording()}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isAwaiting && call.flagReasons.length > 0 ? (
          <div className="space-y-2 border-b border-border-table px-4 py-3">
            <p className="text-sm font-medium text-foreground">Flag reasons</p>
            <div className="flex flex-wrap gap-1.5">
              {call.flagReasons.map((reason) => (
                <Badge
                  key={reason}
                  variant={flagReasonVariant(reason)}
                  className="text-[11px]"
                >
                  {formatFlagReason(reason)}
                </Badge>
              ))}
            </div>
            {hasAiScores ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                The AI grader pre-filled these scores. Adjust any that look
                wrong, then confirm.
              </p>
            ) : null}
          </div>
        ) : null}

        <CallTranscript transcript={call.transcript} status={call.status} />

        {isActive ? (
          <p className="border-b border-border-table px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            This call is still running. Scores and the AI summary will appear
            once it finishes.
          </p>
        ) : null}

        {isAnalysing ? (
          <p className="border-b border-border-table px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            The call has finished. AI is analysing the transcript and will fill
            scores, a call summary, and a coach-note draft shortly.
          </p>
        ) : null}

        <CallAiSummary call={call} />

        {hasScores || isAwaiting ? (
          <ScorecardReviewForm
            criteria={criteria}
            draftScores={draftScores}
            weightedPreview={weightedPreview}
            disabled={!canReview || !isAwaiting}
            onChangeScore={onScoreChange}
          />
        ) : isTerminal ? (
          <div className="border-t border-border-table px-4 py-3">
            <p className="text-sm text-muted-foreground">
              No scorecard results for this call yet.
            </p>
          </div>
        ) : null}

        <div className="border-t border-border-table px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Coach notes</p>
            {call.humanReviewed ? (
              <Badge variant="secondary" className="h-5 text-[10px]">
                Confirmed
              </Badge>
            ) : call.coachingSummary ? (
              <Badge variant="outline" className="h-5 text-[10px]">
                AI draft
              </Badge>
            ) : null}
          </div>
          {isActive ? (
            <p className="text-sm text-muted-foreground">
              Coach notes can be added once the call has finished.
            </p>
          ) : isAnalysing ? (
            <p className="text-sm text-muted-foreground">
              Coach notes can be added after AI finishes analysing.
            </p>
          ) : canReview && isAwaiting ? (
            <>
              <Textarea
                className={cn(fieldControlClassName, 'min-h-24')}
                value={notes}
                placeholder="Edit the AI draft, or write your own notes for this location…"
                onChange={(event) => onNotesChange(event.target.value)}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                AI can draft this. Confirm or change it before you submit the
                review — it is not a coach note until you do.
              </p>
            </>
          ) : notes.trim() || call.coachingSummary ? (
            <p className="text-sm leading-relaxed text-foreground">
              {notes.trim() || call.coachingSummary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No coach notes yet.</p>
          )}
          {actionError ? (
            <p className="mt-2 text-sm text-destructive">{actionError}</p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Scores attach to this location — never to named staff.
          </p>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-table px-4 py-3">
        {canEndCall && isActive && onEndCall ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={ending}
            onClick={onEndCall}
          >
            <PhoneX />
            End call
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={handleClose}>
          Close
        </Button>
        {canReview && isAwaiting ? (
          <Button
            type="button"
            size="sm"
            loading={saving}
            disabled={criteria.length === 0}
            onClick={onSubmit}
          >
            Confirm review
          </Button>
        ) : null}
      </footer>

      {isPreviewOpen && recordingSrc ? (
        <CallRecordingDock
          call={call}
          audioUrl={recordingSrc}
          isPlaying={isPlaying}
          isLoading={recordingLoading}
          isDownloading={isDownloading}
          onTogglePlayPause={togglePlayPause}
          onPlayRequest={play}
          onClose={closePreview}
          onDownload={() => void downloadRecording()}
          onPlaybackEnd={handlePlaybackEnd}
          onWaveSurferReady={handleWaveSurferReady}
          onWaveSurferDestroy={handleWaveSurferDestroy}
        />
      ) : null}
    </div>
  )
}
