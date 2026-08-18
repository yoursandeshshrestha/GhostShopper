import { cn } from '@/lib/utils'
import verifiedIcon from '@/assets/voices/icon4.svg'

const ORB_PAIRS: [string, string][] = [
  ['#CADCFC', '#7B9EC8'],
  ['#F5C6D6', '#C97BA5'],
  ['#D4F0C8', '#6FAF8A'],
  ['#F8E3B8', '#E0A45A'],
  ['#D7C7F8', '#8B73D6'],
  ['#C8F4F0', '#4EB8B0'],
  ['#F8D0C0', '#E07A62'],
  ['#C5D4F8', '#5B7FD6'],
  ['#E8D5C4', '#B8896A'],
  ['#D9F2E8', '#3D9B7A'],
  ['#F3C6E8', '#C45AA0'],
  ['#C9E4F8', '#4A90C8'],
]

function hashSeed(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function orbColorsForId(id: string): [string, string] {
  return ORB_PAIRS[hashSeed(id) % ORB_PAIRS.length]
}

export function VoiceOrb({
  id,
  playing = false,
  verified = false,
}: {
  id: string
  playing?: boolean
  verified?: boolean
}) {
  const [a, b] = orbColorsForId(id)

  return (
    <div className="relative grid size-[70px] shrink-0 place-items-center rounded-2xl bg-black/4 dark:bg-white/6">
      <span
        className={cn(
          'relative size-8 overflow-hidden rounded-full ring-2 ring-white dark:ring-background',
          playing && 'animate-[voice-orb-breathe_1.6s_ease-in-out_infinite]'
        )}
        style={{
          background: `radial-gradient(circle at 32% 28%, ${a} 0%, ${b} 72%)`,
        }}
      >
        <span
          className="absolute -inset-3 rounded-full opacity-80 mix-blend-screen"
          style={{
            background: `conic-gradient(from 40deg, transparent 0%, ${a} 28%, transparent 55%, ${b} 80%, transparent 100%)`,
            animation: `voice-orb-drift ${playing ? 7 : 16}s linear infinite`,
          }}
        />
        <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.55),transparent_58%)]" />
      </span>
      {verified ? (
        <span className="absolute top-3.5 right-3 size-5 overflow-clip">
          <img
            src={verifiedIcon}
            alt=""
            className="size-full"
            width={20}
            height={20}
          />
        </span>
      ) : null}
    </div>
  )
}
