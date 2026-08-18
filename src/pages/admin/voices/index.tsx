import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react'
import addIcon from '@/assets/voices/add.svg'
import waveformIcon from '@/assets/voices/waveform.svg'
import { VoiceOrb } from '@/components/admin/VoiceOrb'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  usePlatformVoices,
  type PlatformVoice,
} from '@/hooks/use-platform-voices'
import { cn } from '@/lib/utils'

type VoiceFilter = 'all' | 'enabled' | 'female' | 'male'

const LANGUAGE_META: Record<string, { name: string; flag: string }> = {
  ar: { name: 'Arabic', flag: '🇸🇦' },
  de: { name: 'German', flag: '🇩🇪' },
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', flag: '🇪🇸' },
  fr: { name: 'French', flag: '🇫🇷' },
  hi: { name: 'Hindi', flag: '🇮🇳' },
  id: { name: 'Indonesian', flag: '🇮🇩' },
  it: { name: 'Italian', flag: '🇮🇹' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  ko: { name: 'Korean', flag: '🇰🇷' },
  nl: { name: 'Dutch', flag: '🇳🇱' },
  pl: { name: 'Polish', flag: '🇵🇱' },
  pt: { name: 'Portuguese', flag: '🇧🇷' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  tr: { name: 'Turkish', flag: '🇹🇷' },
  zh: { name: 'Chinese', flag: '🇨🇳' },
}

function prettyLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function useCaseLabel(voice: PlatformVoice) {
  const useCase = voice.labels.use_case?.trim()
  if (useCase) return prettyLabel(useCase)
  if (voice.category === 'premade') return 'Conversational'
  return voice.category ? prettyLabel(voice.category) : 'Voice'
}

function languageMeta(code: string) {
  return LANGUAGE_META[code.toLowerCase()] ?? {
    name: code.toUpperCase(),
    flag: '🌐',
  }
}

function matchesQuery(voice: PlatformVoice, query: string) {
  if (!query) return true
  const haystack = [
    voice.name,
    voice.description ?? '',
    voice.category ?? '',
    ...voice.languages,
    ...Object.values(voice.labels),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  function toggle(voice: PlatformVoice) {
    if (!voice.previewUrl) return

    if (playingId === voice.voiceId) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio
    audio.addEventListener('ended', () => {
      if (audioRef.current === audio) {
        audioRef.current = null
        setPlayingId(null)
      }
    })
    void audio.play().then(
      () => setPlayingId(voice.voiceId),
      () => {
        audioRef.current = null
        setPlayingId(null)
      }
    )
  }

  return { playingId, toggle }
}

export function AdminVoicesPage() {
  const { loading, savingId, error, voices, enabledCount, refresh, saveVoice } =
    usePlatformVoices()
  const [filter, setFilter] = useState<VoiceFilter>('all')
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const { playingId, toggle } = useVoicePreview()

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return voices.filter((voice) => {
      if (filter === 'enabled' && !voice.enabled) return false
      if (filter === 'female' && voice.gender !== 'female') return false
      if (filter === 'male' && voice.gender !== 'male') return false
      return matchesQuery(voice, needle)
    })
  }, [filter, query, voices])

  return (
    <AppPage
      title="Voices"
      count={enabledCount || undefined}
      loading={loading}
      actions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
        >
          Refresh catalog
        </Button>
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Could not load or save voices</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {voices.length === 0 && !loading ? (
        <PageEmptyState
          title="No voices yet"
          description="Connect ElevenLabs, then refresh to load voices from your account."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, accent, language…"
                className="pl-9"
              />
            </div>
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as VoiceFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="enabled">Pool</TabsTrigger>
                <TabsTrigger value="female">Female</TabsTrigger>
                <TabsTrigger value="male">Male</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {visible.length === 0 ? (
            <PageEmptyState
              title="No matching voices"
              description="Try another search or filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((voice) => (
                <VoiceCard
                  key={voice.voiceId}
                  voice={voice}
                  playing={playingId === voice.voiceId}
                  saving={savingId === voice.voiceId}
                  onTogglePreview={() => toggle(voice)}
                  onSave={(patch) => {
                    setActionError(null)
                    void saveVoice(voice, patch).then((result) => {
                      if (result.error) setActionError(result.error)
                    })
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </AppPage>
  )
}

function VoiceCard({
  voice,
  playing,
  saving,
  onTogglePreview,
  onSave,
}: {
  voice: PlatformVoice
  playing: boolean
  saving: boolean
  onTogglePreview: () => void
  onSave: (patch: Partial<Pick<PlatformVoice, 'enabled'>>) => void
}) {
  const languages =
    voice.languages.length > 0
      ? voice.languages
      : voice.labels.language
        ? [voice.labels.language]
        : []
  const primary = languages[0] ? languageMeta(languages[0]) : null
  const extraCount = Math.max(languages.length - 1, 0)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-[20px] p-2 transition-colors',
        'hover:bg-black/4 dark:hover:bg-white/6',
        playing && 'bg-black/4 dark:bg-white/6'
      )}
    >
      <VoiceOrb id={voice.voiceId} playing={playing} verified={voice.enabled} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-[-0.2px] text-foreground">
          {voice.name}
        </p>
        <p className="truncate text-[13px] capitalize leading-[19.5px] text-black/53 dark:text-white/53">
          {useCaseLabel(voice)}
        </p>
        {primary ? (
          <div className="mt-1 flex items-center gap-1">
            <span className="flex size-3.5 items-center justify-center overflow-hidden rounded-full text-[10px] leading-none ring-2 ring-background">
              {primary.flag}
            </span>
            <span className="text-[13px] text-black/53 dark:text-white/53">
              {primary.name}
            </span>
            {extraCount > 0 ? (
              <span className="rounded-full bg-black/3 px-1 py-0.5 text-[10px] font-semibold tracking-[0.025px] text-black/53 dark:bg-white/8 dark:text-white/53">
                +{extraCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-1 pr-1',
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          playing && 'opacity-100'
        )}
      >
        <IconButton
          label={voice.enabled ? 'Remove from pool' : 'Add to pool'}
          src={addIcon}
          disabled={saving}
          active={voice.enabled}
          onClick={() => onSave({ enabled: !voice.enabled })}
        />
        <IconButton
          label={playing ? 'Pause preview' : 'Play preview'}
          src={waveformIcon}
          disabled={!voice.previewUrl}
          active={playing}
          onClick={onTogglePreview}
        />
      </div>
    </div>
  )
}

function IconButton({
  label,
  src,
  disabled,
  active,
  onClick,
}: {
  label: string
  src: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-lg outline-none',
        'hover:bg-black/6 focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'dark:hover:bg-white/10',
        active && 'bg-black/6 dark:bg-white/10'
      )}
    >
      <img
        src={src}
        alt=""
        width={18}
        height={18}
        className="size-4.5 dark:invert"
      />
    </button>
  )
}
