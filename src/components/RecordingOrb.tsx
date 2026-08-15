import { cn } from '@/lib/utils'

interface RecordingOrbProps {
  size?: number
  className?: string
}

export function RecordingOrb({ size = 48, className }: RecordingOrbProps) {
  return (
    <div
      className={cn(
        'shrink-0 rounded-full bg-gradient-to-br from-primary via-[#ff8a65] to-[#c2410c] shadow-md',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}
