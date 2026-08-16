import type { OrgRole } from '@/components/auth/AuthProvider'

export const TEAM_ROLE_OPTIONS: {
  value: Exclude<OrgRole, 'owner'>
  label: string
}[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'location_viewer', label: 'Location viewer' },
]

export function formatRole(role: string) {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    coach: 'Coach',
    location_viewer: 'Location viewer',
    superadmin: 'Superadmin',
  }
  return labels[role] ?? role.replace(/_/g, ' ')
}

export function getInitials(name: string | null, email: string) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return email[0]?.toUpperCase() ?? '?'
}

export function roleBadgeVariant(role: string) {
  if (role === 'superadmin') return 'superadmin' as const
  if (role === 'owner') return 'owner' as const
  if (role === 'admin') return 'admin' as const
  if (role === 'coach') return 'coach' as const
  if (role === 'location_viewer') return 'viewer' as const
  return 'outline' as const
}
