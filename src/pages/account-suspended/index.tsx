import { useAuth } from '@/components/auth/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'

export function AccountSuspendedPage() {
  const { profile, organisation, signOut } = useAuth()

  const reason = profile?.suspendedAt
    ? 'Your account has been suspended.'
    : organisation?.suspendedAt
      ? 'Your organisation has been suspended.'
      : 'Your access to GhostShopper has been suspended.'

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          Account suspended
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Contact your administrator if you need access restored.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={() => void signOut()}
        >
          Back to login
        </Button>
      </div>
    </AuthLayout>
  )
}
