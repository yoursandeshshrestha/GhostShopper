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
  if (role === 'owner') return 'default' as const
  if (role === 'admin') return 'secondary' as const
  return 'outline' as const
}
