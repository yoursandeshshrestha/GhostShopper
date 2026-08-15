import { AudioPreviewBar } from '@/components/AudioPreviewBar'
import { RecordingOrb } from '@/components/RecordingOrb'
import { formatDateTime } from '@/lib/datetime'
import type { OrgCall } from '@/types/org'
import type WaveSurfer from 'wavesurfer.js'

interface CallRecordingDockProps {
  call: OrgCall
  audioUrl: string
  isPlaying: boolean
  isLoading?: boolean
  isDownloading?: boolean
  onTogglePlayPause: () => void
  onPlayRequest?: () => void
  onClose?: () => void
  onDownload?: () => void
  onPlaybackEnd?: () => void
  onWaveSurferReady?: (wavesurfer: WaveSurfer) => void
  onWaveSurferDestroy?: () => void
  className?: string
}

export function CallRecordingDock({
  call,
  audioUrl,
  isPlaying,
  isLoading = false,
  isDownloading = false,
  onTogglePlayPause,
  onPlayRequest,
  onClose,
  onDownload,
  onPlaybackEnd,
  onWaveSurferReady,
  onWaveSurferDestroy,
  className,
}: CallRecordingDockProps) {
  const title = formatDateTime(call.createdAt)
  const subtitle = call.locationName

  return (
    <AudioPreviewBar
      audioUrl={audioUrl}
      title={title}
      subtitle={subtitle}
      isPlaying={isPlaying}
      isLoading={isLoading}
      onTogglePlayPause={onTogglePlayPause}
      onPlayRequest={onPlayRequest}
      onClose={onClose}
      onDownload={onDownload}
      isDownloading={isDownloading}
      onPlaybackEnd={onPlaybackEnd}
      onWaveSurferReady={onWaveSurferReady}
      onWaveSurferDestroy={onWaveSurferDestroy}
      ariaLabel={`Call recording: ${call.locationName}`}
      icon={<RecordingOrb size={48} />}
      className={className}
    />
  )
}
