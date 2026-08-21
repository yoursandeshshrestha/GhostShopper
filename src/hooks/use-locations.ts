import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgContext } from '@/hooks/use-org-context'
import { canManageLocations } from '@/lib/permissions'
import { locationBandErrorMessage } from '@/lib/pricing'
import { mergeById, pageRange } from '@/lib/pagination'
import { supabase } from '@/lib/supabase/client'
import type { LocationInput, OrgLocation } from '@/types/location'

function mapLocation(row: Record<string, unknown>): OrgLocation {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    timezone: (row.timezone as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    callFrequency: (row.call_frequency as string | null) ?? null,
  }
}

export function useLocations() {
  const { profile, orgId, isImpersonating } = useOrgContext()
  const canManage = canManageLocations(profile?.role)
  const canOverrideBand = isImpersonating

  const [loading, setLoading] = useState(Boolean(orgId))
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<OrgLocation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const locationsRef = useRef<OrgLocation[]>([])
  const totalCountRef = useRef(0)
  const loadingMoreRef = useRef(false)
  locationsRef.current = locations
  totalCountRef.current = totalCount

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!orgId) {
        setLocations([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      if (!reset && loadingMoreRef.current) return
      if (
        !reset &&
        totalCountRef.current > 0 &&
        locationsRef.current.length >= totalCountRef.current
      ) {
        return
      }

      if (reset) {
        setLoading(true)
        setError(null)
      } else {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const { from, to } = pageRange(reset ? 0 : locationsRef.current.length)

      let query = supabase
        .from('locations')
        .select('id, name, phone, timezone, country, call_frequency', {
          count: reset ? 'exact' : undefined,
        })
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .range(from, to)

      if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
        query = query.eq('id', profile.assignedLocationId)
      }

      const { data, error: queryError, count } = await query

      if (queryError) {
        setError(queryError.message)
        if (reset) setLocations([])
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
        return
      }

      const rows = (data ?? []).map((row) => mapLocation(row))
      setLocations((current) => mergeById(current, rows, reset))
      if (typeof count === 'number') setTotalCount(count)
      else if (reset) setTotalCount(rows.length)

      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    },
    [orgId, profile?.assignedLocationId, profile?.role]
  )

  const refresh = useCallback(async () => {
    await fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createLocation = useCallback(
    async (input: LocationInput) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to add locations.' }
      }

      const name = input.name.trim()
      if (!name) return { error: 'Location name is required.' }

      setSaving(true)
      setError(null)

      const { data, error: insertError } = await supabase
        .from('locations')
        .insert({
          org_id: orgId,
          name,
          phone: input.phone.trim() || null,
          timezone: input.timezone || null,
          country: input.country || null,
          call_frequency: input.callFrequency || null,
        })
        .select('id, name, phone, timezone, country, call_frequency')
        .single()

      setSaving(false)

      if (insertError || !data) {
        const message = insertError?.message ?? 'Could not create location.'
        const bandError = locationBandErrorMessage(message)
        setError(bandError ?? message)
        return {
          error: bandError ?? message,
          bandExceeded: Boolean(bandError),
        }
      }

      const created = mapLocation(data)
      setLocations((current) => [...current, created])
      setTotalCount((count) => count + 1)
      return { error: null, location: created }
    },
    [canManage, orgId]
  )

  const createLocationWithOverride = useCallback(
    async (input: LocationInput) => {
      if (!orgId || !canOverrideBand) {
        return { error: 'Only a platform operator can override the location band.' }
      }

      const name = input.name.trim()
      if (!name) return { error: 'Location name is required.' }

      setSaving(true)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc(
        'create_location_with_band_override',
        {
          p_org_id: orgId,
          p_name: name,
          p_phone: input.phone.trim() || null,
          p_timezone: input.timezone || null,
          p_country: input.country || null,
          p_call_frequency: input.callFrequency || null,
        }
      )

      setSaving(false)

      if (rpcError || !data) {
        const message = rpcError?.message ?? 'Could not create location.'
        setError(message)
        return { error: message }
      }

      const created = mapLocation(data as Record<string, unknown>)
      setLocations((current) => [...current, created])
      setTotalCount((count) => count + 1)
      return { error: null, location: created }
    },
    [canOverrideBand, orgId]
  )

  const updateLocation = useCallback(
    async (id: string, input: LocationInput) => {
      if (!canManage) {
        return { error: 'You do not have permission to edit locations.' }
      }

      const name = input.name.trim()
      if (!name) return { error: 'Location name is required.' }

      setSaving(true)
      setError(null)

      const { data, error: updateError } = await supabase
        .from('locations')
        .update({
          name,
          phone: input.phone.trim() || null,
          timezone: input.timezone || null,
          country: input.country || null,
          call_frequency: input.callFrequency || null,
        })
        .eq('id', id)
        .select('id, name, phone, timezone, country, call_frequency')
        .single()

      setSaving(false)

      if (updateError || !data) {
        const message = updateError?.message ?? 'Could not update location.'
        setError(message)
        return { error: message }
      }

      const updated = mapLocation(data)
      setLocations((current) =>
        current.map((row) => (row.id === id ? updated : row))
      )
      return { error: null, location: updated }
    },
    [canManage]
  )

  const deleteLocation = useCallback(
    async (id: string) => {
      if (!canManage) {
        return { error: 'You do not have permission to delete locations.' }
      }

      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      setSaving(false)

      if (deleteError) {
        setError(deleteError.message)
        return { error: deleteError.message }
      }

      setLocations((current) => current.filter((row) => row.id !== id))
      setTotalCount((count) => Math.max(0, count - 1))
      return { error: null }
    },
    [canManage]
  )

  const deleteLocations = useCallback(
    async (ids: string[]) => {
      if (!canManage) {
        return { error: 'You do not have permission to delete locations.' }
      }

      const uniqueIds = [...new Set(ids)]
      if (uniqueIds.length === 0) {
        return { error: 'Select at least one location to delete.' }
      }

      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .in('id', uniqueIds)

      setSaving(false)

      if (deleteError) {
        setError(deleteError.message)
        return { error: deleteError.message }
      }

      const idSet = new Set(uniqueIds)
      setLocations((current) => current.filter((row) => !idSet.has(row.id)))
      setTotalCount((count) => Math.max(0, count - uniqueIds.length))
      return { error: null, count: uniqueIds.length }
    },
    [canManage]
  )

  const importLocations = useCallback(
    async (inputs: LocationInput[]) => {
      if (!orgId || !canManage) {
        return { error: 'You do not have permission to import locations.' }
      }

      const rows = inputs
        .map((input) => ({
          org_id: orgId,
          name: input.name.trim(),
          phone: input.phone.trim() || null,
          timezone: input.timezone || null,
          country: input.country || null,
          call_frequency: input.callFrequency || null,
        }))
        .filter((row) => row.name)

      if (rows.length === 0) {
        return { error: 'No valid location rows found.' }
      }

      setSaving(true)
      setError(null)

      const { data, error: insertError } = await supabase
        .from('locations')
        .insert(rows)
        .select('id, name, phone, timezone, country, call_frequency')

      setSaving(false)

      if (insertError) {
        const message = insertError.message
        const bandError = locationBandErrorMessage(message)
        setError(bandError ?? message)
        return { error: bandError ?? message, bandExceeded: Boolean(bandError) }
      }

      await fetchPage(true)
      return { error: null, count: (data ?? []).length }
    },
    [canManage, fetchPage, orgId]
  )

  return {
    loading,
    loadingMore,
    saving,
    error,
    locations,
    totalCount,
    hasMore: locations.length < totalCount,
    canManage,
    canOverrideBand,
    refresh,
    loadMore,
    createLocation,
    createLocationWithOverride,
    updateLocation,
    deleteLocation,
    deleteLocations,
    importLocations,
  }
}
