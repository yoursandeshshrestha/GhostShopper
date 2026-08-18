import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserSwitch } from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { appHome } from '@/lib/permissions'

interface ImpersonateUserButtonProps {
  userId: string
  disabled?: boolean
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost' | 'default'
}

export function ImpersonateUserButton({
  userId,
  disabled = false,
  size = 'sm',
  variant = 'outline',
}: ImpersonateUserButtonProps) {
  const navigate = useNavigate()
  const { startImpersonation } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await startImpersonation(userId)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    navigate(appHome(result.role), { replace: true })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled || loading}
        loading={loading}
        onClick={() => void handleClick()}
      >
        <UserSwitch />
        View as user
      </Button>
      {error ? (
        <p className="max-w-48 text-right text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
