export const LIST_PAGE_SIZE = 20

export function pageRange(loadedCount: number, pageSize = LIST_PAGE_SIZE) {
  return {
    from: loadedCount,
    to: loadedCount + pageSize - 1,
  }
}

export function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
  reset: boolean
) {
  if (reset) return incoming
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !seen.has(item.id))]
}

export function nestedCount(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { count?: number } | undefined
    return Number(first?.count) || 0
  }
  if (value && typeof value === 'object' && 'count' in value) {
    return Number((value as { count?: number }).count) || 0
  }
  return 0
}
