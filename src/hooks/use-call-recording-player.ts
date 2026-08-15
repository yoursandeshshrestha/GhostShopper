import { useCallback, useEffect, useRef, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import { useCallRecording } from '@/hooks/use-call-recording'

interface UseCallRecordingPlayerOptions {
  callId: string
  recordingPath: string | null
}

export function useCallRecordingPlayer({
  callId,
  recordingPath,
}: UseCallRecordingPlayerOptions) {
  const { src, loading, error } = useCallRecording(recordingPath)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    setIsPreviewOpen(false)
    setIsPaused(false)
  }, [callId])

  const stopRecording = useCallback(() => {
    wavesurferRef.current?.pause()
    setIsPaused(true)
  }, [])

  const closePreview = useCallback(() => {
    stopRecording()
    setIsPreviewOpen(false)
  }, [stopRecording])

  const togglePlayPause = useCallback(() => {
    setIsPaused((current) => !current)
  }, [])

  const play = useCallback(() => {
    setIsPaused(false)
  }, [])

  const openPreview = useCallback(() => {
    if (!src) return
    setIsPreviewOpen(true)
    setIsPaused(false)
  }, [src])

  const handlePlaybackEnd = useCallback(() => {
    setIsPaused(true)
  }, [])

  const handleWaveSurferReady = useCallback((wavesurfer: WaveSurfer) => {
    wavesurferRef.current = wavesurfer
  }, [])

  const handleWaveSurferDestroy = useCallback(() => {
    wavesurferRef.current = null
  }, [])

  const downloadRecording = useCallback(async () => {
    if (!src) return
    try {
      setIsDownloading(true)
      const response = await fetch(src)
      if (!response.ok) throw new Error('Failed to fetch recording')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      const extension = blob.type?.includes('wav') ? 'wav' : 'mp3'
      link.download = `call-${callId}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } finally {
      setIsDownloading(false)
    }
  }, [callId, src])

  return {
    src,
    loading,
    error,
    isPreviewOpen,
    isPlaying: Boolean(src) && !isPaused,
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
  }
}
