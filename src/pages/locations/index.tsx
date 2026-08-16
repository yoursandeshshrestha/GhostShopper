import { useMemo, useState } from 'react'
import { PencilSimple, Plus, Trash, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { LocationFormDialog } from '@/components/locations/LocationFormDialog'
import { LocationCsvImportDialog } from '@/components/locations/LocationCsvImportPanel'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { LoadMoreButton } from '@/components/layout/LoadMoreButton'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocations } from '@/hooks/use-locations'
import { CountryFlag, TimezoneFlag } from '@/lib/flags'
import type { LocationInput, OrgLocation } from '@/types/location'

export function LocationsPage() {
  const {
    loading,
    loadingMore,
    saving,
    error,
    locations,
    totalCount,
    hasMore,
    loadMore,
    canManage,
    createLocation,
    updateLocation,
    deleteLocation,
    deleteLocations,
    importLocations,
  } = useLocations()

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<OrgLocation | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<OrgLocation | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectedCount = selectedIds.size
  const allSelected =
    locations.length > 0 && selectedCount === locations.length
  const someSelected = selectedCount > 0 && !allSelected

  const selectedLocations = useMemo(
    () => locations.filter((location) => selectedIds.has(location.id)),
    [locations, selectedIds]
  )

  function openCreate() {
    setEditing(null)
    setActionError(null)
    setFormOpen(true)
  }

  function openEdit(location: OrgLocation) {
    setEditing(location)
    setActionError(null)
    setFormOpen(true)
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(locations.map((location) => location.id)))
      return
    }
    setSelectedIds(new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleSubmit(input: LocationInput) {
    setActionError(null)
    const result = editing
      ? await updateLocation(editing.id, input)
      : await createLocation(input)

    if (result.error) {
      setActionError(result.error)
      return result.error
    }

    return null
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setActionError(null)
    const result = await deleteLocation(pendingDelete.id)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(pendingDelete.id)
      return next
    })
    setPendingDelete(null)
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return
    setActionError(null)
    const result = await deleteLocations([...selectedIds])
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
  }

  return (
    <AppPage
      title="Locations"
      count={totalCount > 0 ? totalCount : undefined}
      loading={loading}
      actions={
        canManage ? (
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash />
                Delete ({selectedCount})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <UploadSimple />
              Import CSV
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus />
              Add location
            </Button>
          </div>
        ) : undefined
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {locations.length === 0 ? (
        <PageEmptyState
          title="No locations yet"
          description="Add your first location so mystery-shop calls have somewhere to go."
          action={
            canManage ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus />
                Add location
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SurfaceCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canManage ? (
                  <TableHead className="w-[1%]">
                    <Checkbox
                      aria-label="Select all locations"
                      checked={
                        allSelected ? true : someSelected ? 'indeterminate' : false
                      }
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                    />
                  </TableHead>
                ) : null}
                <TableHead>Location</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Country</TableHead>
                {canManage ? (
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow
                  key={location.id}
                  data-state={
                    selectedIds.has(location.id) ? 'selected' : undefined
                  }
                >
                  {canManage ? (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${location.name}`}
                        checked={selectedIds.has(location.id)}
                        onCheckedChange={(checked) =>
                          toggleOne(location.id, checked === true)
                        }
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium text-foreground">
                    {location.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {location.phone || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {location.timezone ? (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <TimezoneFlag timezone={location.timezone} />
                        <span className="truncate">{location.timezone}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {location.country ? (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <CountryFlag country={location.country} />
                        <span className="truncate">{location.country}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${location.name}`}
                          onClick={() => openEdit(location)}
                        >
                          <PencilSimple />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${location.name}`}
                          onClick={() => setPendingDelete(location)}
                        >
                          <Trash />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        </SurfaceCard>
      )}

      <LocationFormDialog
        open={formOpen}
        location={editing}
        saving={saving}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      <LocationCsvImportDialog
        open={importOpen}
        saving={saving}
        onOpenChange={setImportOpen}
        onImport={importLocations}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.name}” will be removed from your network. This cannot be undone.`
                : 'This location will be removed from your network.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} location{selectedCount === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount === 1 ? (
                <>
                  “{selectedLocations[0]?.name}” will be removed from your
                  network. This cannot be undone.
                </>
              ) : (
                <>
                  {selectedCount} locations will be removed from your network.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                void handleBulkDelete()
              }}
            >
              Delete {selectedCount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  )
}
