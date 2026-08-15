import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'

export function useAwaitingReviewCount() {
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!orgId) {
      setCount(0)
      return
    }

    let query = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'awaiting_review')

    if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
      query = query.eq('location_id', profile.assignedLocationId)
    }

    const { count: nextCount } = await query
    setCount(nextCount ?? 0)
  }, [orgId, profile?.assignedLocationId, profile?.role])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`awaiting-review:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, refresh])

  return count
}
