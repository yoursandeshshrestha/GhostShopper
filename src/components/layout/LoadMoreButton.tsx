import { Button } from '@/components/ui/button'

export function LoadMoreButton({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  if (!hasMore) return null

  return (
    <div className="flex justify-center py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={loading}
        onClick={onLoadMore}
      >
        Load more
      </Button>
    </div>
  )
}
