const STORAGE_KEY = 'ghostshopper:impersonation'

export interface ImpersonationSnapshot {
  userId: string
  orgId: string | null
  startedAt: string
}

export function readImpersonationSnapshot(): ImpersonationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonationSnapshot
    if (!parsed?.userId) return null
    return parsed
  } catch {
    return null
  }
}

export function writeImpersonationSnapshot(snapshot: ImpersonationSnapshot) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearImpersonationSnapshot() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function getImpersonationOrgId(): string | null {
  return readImpersonationSnapshot()?.orgId ?? null
}
