import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { canManageLocations } from '@/lib/permissions'
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
  const { organisation, profile } = useAuth()
  const orgId = organisation?.id ?? profile?.orgId ?? null
  const canManage = canManageLocations(profile?.role)

  const [loading, setLoading] = useState(Boolean(orgId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<OrgLocation[]>([])

  const refresh = useCallback(async () => {
    if (!orgId) {
      setLocations([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('locations')
      .select('id, name, phone, timezone, country, call_frequency')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setLocations([])
      setLoading(false)
      return
    }

    let rows = (data ?? []).map((row) => mapLocation(row))

    if (profile?.role === 'location_viewer' && profile.assignedLocationId) {
      rows = rows.filter((row) => row.id === profile.assignedLocationId)
    }

    setLocations(rows)
    setLoading(false)
  }, [orgId, profile?.assignedLocationId, profile?.role])

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
        setError(message)
        return { error: message }
      }

      const created = mapLocation(data)
      setLocations((current) => [...current, created])
      return { error: null, location: created }
    },
    [canManage, orgId]
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
        setError(insertError.message)
        return { error: insertError.message }
      }

      const created = (data ?? []).map((row) => mapLocation(row))
      setLocations((current) => [...current, ...created])
      return { error: null, count: created.length }
    },
    [canManage, orgId]
  )

  return {
    loading,
    saving,
    error,
    locations,
    canManage,
    refresh,
    createLocation,
    updateLocation,
    deleteLocation,
    deleteLocations,
    importLocations,
  }
}
