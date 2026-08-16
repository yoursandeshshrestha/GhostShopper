import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { CallStatus } from '@/types/org'
import { cn } from '@/lib/utils'

type SpeakerSide = 'caller' | 'staff' | 'unknown'

interface TranscriptLine {
  side: SpeakerSide
  label: string
  text: string
}

function resolveSpeaker(raw: string): { side: SpeakerSide; label: string } {
  const role = raw.trim().toLowerCase()
  if (role === 'agent' || role === 'caller') {
    return { side: 'caller', label: 'Caller' }
  }
  if (role === 'user' || role === 'staff') {
    return { side: 'staff', label: 'Staff' }
  }
  return { side: 'unknown', label: raw.trim() || 'Unknown' }
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-z_]+):\s*(.*)$/i)
      if (!match) {
        return { side: 'unknown' as const, label: 'Unknown', text: line }
      }
      const speaker = resolveSpeaker(match[1])
      return {
        side: speaker.side,
        label: speaker.label,
        text: match[2] || '',
      }
    })
}

function emptyMessage(status: CallStatus) {
  if (status === 'queued') {
    return 'Waiting for the call to connect…'
  }
  if (status === 'in_progress') {
    return 'Call in progress. The transcript will appear here as the conversation continues.'
  }
  if (status === 'analysing') {
    return 'The call has finished. AI is analysing the conversation…'
  }
  if (status === 'voicemail') {
    return 'This call reached voice mail. It was not graded.'
  }
  if (status === 'line_busy') {
    return 'The line was busy. It was not graded.'
  }
  if (status === 'short_call') {
    return 'This was a short call. It was not graded.'
  }
  if (status === 'failed' || status === 'missed') {
    return 'No transcript was captured for this call.'
  }
  return 'No transcript for this call'
}

interface CallTranscriptProps {
  transcript: string | null
  status: CallStatus
}

export function CallTranscript({ transcript, status }: CallTranscriptProps) {
  const isActive = status === 'queued' || status === 'in_progress'
  const isAnalysing = status === 'analysing'
  const lines = transcript ? parseTranscript(transcript) : []

  async function copyTranscript() {
    if (!transcript) return
    await navigator.clipboard.writeText(transcript)
  }

  return (
    <div className="border-t border-border-table">
      <div className="flex items-center justify-between border-b border-border-table px-4 py-2">
        <span className="text-sm font-medium text-foreground">Transcription</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          disabled={!transcript}
          onClick={() => void copyTranscript()}
        >
          <Copy className="size-3.5" />
          Copy transcript
        </Button>
      </div>
      <div className="px-4 py-3">
        {lines.length === 0 ? (
          <p
            className={cn(
              'text-sm',
              isActive ? 'py-8 text-center text-muted-foreground' : 'text-muted-foreground'
            )}
          >
            {emptyMessage(status)}
          </p>
        ) : (
          <div className="space-y-3">
            {isActive ? (
              <p className="text-xs text-muted-foreground">
                Live transcript · updates automatically when the call ends
              </p>
            ) : isAnalysing ? (
              <p className="text-xs text-muted-foreground">
                Call finished · AI is analysing this transcript
              </p>
            ) : null}
            {lines.map((line, index) => {
              const isStaff = line.side === 'staff'
              return (
                <div
                  key={`${index}-${line.text.slice(0, 12)}`}
                  className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                      isStaff
                        ? 'bg-foreground/5 text-foreground'
                        : 'bg-muted/60 text-foreground'
                    )}
                  >
                    {line.text}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
