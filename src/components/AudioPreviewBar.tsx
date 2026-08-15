import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import WaveSurfer from 'wavesurfer.js'
import { useTheme } from 'next-themes'
import {
  DownloadSimple as DownloadIcon,
  Pause,
  Play,
  X,
} from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { getWaveformColors } from '@/lib/waveform-colors'
import { cn } from '@/lib/utils'

export interface AudioPreviewBarProps {
  audioUrl: string
  title: string
  subtitle?: string
  description?: string
  isPlaying: boolean
  isLoading?: boolean
  onTogglePlayPause: () => void
  onPlayRequest?: () => void
  onClose?: () => void
  onPlaybackEnd?: () => void
  onWaveSurferReady?: (wavesurfer: WaveSurfer) => void
  onWaveSurferDestroy?: () => void
  onDownload?: () => void
  isDownloading?: boolean
  ariaLabel?: string
  icon: ReactNode
  className?: string
  inline?: boolean
}

export function AudioPreviewBar({
  audioUrl,
  title,
  subtitle,
  description,
  isPlaying,
  isLoading = false,
  onTogglePlayPause,
  onPlayRequest,
  onClose,
  onPlaybackEnd,
  onWaveSurferReady,
  onWaveSurferDestroy,
  onDownload,
  isDownloading = false,
  ariaLabel,
  icon,
  className,
  inline = false,
}: AudioPreviewBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [waveReady, setWaveReady] = useState(false)
  const [waveError, setWaveError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!containerRef.current) return

    const colors = getWaveformColors()
    setWaveError(null)

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: colors.cursorColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 40,
      normalize: true,
      interact: true,
    })

    wavesurferRef.current = wavesurfer
    setWaveReady(false)
    wavesurfer.load(audioUrl)

    wavesurfer.on('ready', () => {
      setWaveReady(true)
      setWaveError(null)
      onWaveSurferReady?.(wavesurfer)
    })

    wavesurfer.on('error', () => {
      setWaveReady(false)
      setWaveError('Failed to load audio')
    })

    wavesurfer.on('interaction', () => {
      onPlayRequest?.()
      void wavesurfer.play()
    })

    wavesurfer.on('finish', () => {
      onPlaybackEnd?.()
    })

    return () => {
      onWaveSurferDestroy?.()
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [audioUrl, onPlaybackEnd, onPlayRequest, onWaveSurferDestroy, onWaveSurferReady, resolvedTheme])

  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws || !waveReady) return
    if (isPlaying) {
      void ws.play()
    } else {
      ws.pause()
    }
  }, [isPlaying, waveReady])

  const playPauseButton = (
    <div className="relative size-12 shrink-0">
      {icon}
      <button
        type="button"
        onClick={onTogglePlayPause}
        disabled={isLoading || !waveReady}
        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full text-white drop-shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading || !waveReady ? (
          <Spinner size="sm" className="text-white" aria-label="Loading" />
        ) : isPlaying ? (
          <Pause className="size-4" weight="fill" />
        ) : (
          <Play className="size-4" weight="fill" />
        )}
      </button>
    </div>
  )

  const actionButtons = (
    <div className="flex shrink-0 items-center gap-0.5">
      {onDownload ? (
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Download audio"
        >
          {isDownloading ? (
            <Spinner size="sm" aria-label="Downloading" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
        </button>
      ) : null}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close audio preview"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )

  const isWaveLoading = isLoading || (!waveReady && !waveError)
  const waveformEl = (
    <div className="relative min-h-10 w-full">
      <div
        ref={containerRef}
        className={cn(
          'min-h-10 w-full',
          isWaveLoading ? 'cursor-wait opacity-30' : 'cursor-pointer'
        )}
      />
      {waveError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-destructive">
          {waveError}
        </div>
      ) : isWaveLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Spinner size="xs" aria-label="Loading audio waveform" />
          <span>Loading audio…</span>
        </div>
      ) : null}
    </div>
  )

  const barContent = (
    <div className="overflow-hidden border-t border-border-subtle bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        {playPauseButton}

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm leading-5">
            <span className="font-semibold">{title}</span>
            {subtitle ? (
              <span className="text-muted-foreground"> · {subtitle}</span>
            ) : null}
          </p>
          {description ? (
            <p className="line-clamp-1 text-xs leading-4 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {actionButtons}
      </div>

      <div className="border-t border-border-subtle" />

      <div className="px-4 pt-2.5 pb-3">{waveformEl}</div>
    </div>
  )

  if (inline) {
    return (
      <div
        className={cn('w-full', className)}
        role="region"
        aria-label={ariaLabel ?? `Audio preview: ${title}`}
      >
        {barContent}
      </div>
    )
  }

  const content = (
    <div
      className={cn(
        'pointer-events-auto fixed bottom-4 left-1/2 z-100 w-[min(100%-2rem,42rem)] -translate-x-1/2',
        'lg:left-[calc(16rem+((100%-16rem-520px)/2))]',
        className
      )}
      role="region"
      aria-label={ariaLabel ?? `Audio preview: ${title}`}
    >
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-lg">
        {barContent}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
