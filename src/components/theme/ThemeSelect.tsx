import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

interface ThemeSelectProps {
  className?: string
  triggerClassName?: string
}

export function ThemeSelect({ className, triggerClassName }: ThemeSelectProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0]
  const Icon = current.icon

  return (
    <div className={className}>
      <Select
        value={mounted ? theme : 'dark'}
        onValueChange={(value) => setTheme(value)}
      >
        <SelectTrigger
          className={cn('w-full max-w-md justify-between', triggerClassName)}
          disabled={!mounted}
        >
          <span className="flex items-center gap-2">
            <Icon className="size-4 shrink-0" />
            <SelectValue placeholder="Theme" />
          </span>
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200]">
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <option.icon className="size-4 shrink-0" />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
