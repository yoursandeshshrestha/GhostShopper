import { InfoLine } from '@/components/layout/InfoLine'

interface CallRecordingActionsProps {
  hasRecording: boolean
  loading: boolean
  error: string | null
  playbackReady: boolean
  isDownloading: boolean
  onPlay: () => void
  onDownload: () => void
}

export function CallRecordingActions({
  hasRecording,
  loading,
  error,
  playbackReady,
  isDownloading,
  onPlay,
  onDownload,
}: CallRecordingActionsProps) {
  if (!hasRecording) return null

  if (loading) {
    return (
      <InfoLine label="Recording">
        <span className="text-muted-foreground">Loading…</span>
      </InfoLine>
    )
  }

  if (error) {
    return (
      <InfoLine label="Recording">
        <span className="text-destructive">Could not load recording</span>
      </InfoLine>
    )
  }

  if (!playbackReady) return null

  return (
    <InfoLine label="Recording">
      <button
        type="button"
        onClick={onPlay}
        className="cursor-pointer transition-colors hover:text-foreground"
      >
        Play
      </button>
      <span aria-hidden="true"> · </span>
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloading}
        className="cursor-pointer transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isDownloading ? 'Downloading…' : 'Download'}
      </button>
    </InfoLine>
  )
}
