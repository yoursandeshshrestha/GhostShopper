import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  preventDialogDismissForPortals,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationCsvPreview } from '@/components/locations/LocationCsvPreview'
import { LocationCsvUploadZone } from '@/components/locations/LocationCsvUploadZone'
import {
  CSV_LOCATION_FIELDS,
  mapCsvRowsToLocations,
  parseLocationCsvFile,
  type CsvLocationColumn,
} from '@/lib/csv-locations'
import { cn } from '@/lib/utils'
import type { LocationInput } from '@/types/location'

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

function preventSelectDismiss(event: {
  preventDefault: () => void
  target: EventTarget | null
}) {
  preventDialogDismissForPortals(event)
}

function LocationCsvMappingSection({
  headers,
  mapping,
  onMappingChange,
}: {
  headers: string[]
  mapping: CsvLocationColumn[]
  onMappingChange: (index: number, value: CsvLocationColumn) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Map columns</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden border-b border-border bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)] sm:gap-3">
          <span>CSV column</span>
          <span>Maps to</span>
        </div>
        <div className="divide-y divide-border">
          {headers.map((header, index) => (
            <div
              key={`${header}-${index}`}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)] sm:items-center"
            >
              <p
                className="truncate text-sm text-foreground"
                title={header || `Column ${index + 1}`}
              >
                {header || `Column ${index + 1}`}
              </p>
              <Select
                value={mapping[index]}
                onValueChange={(value) =>
                  onMappingChange(index, value as CsvLocationColumn)
                }
              >
                <SelectTrigger
                  className={cn(
                    fieldControlClassName,
                    'min-w-0 justify-between gap-2 dark:bg-transparent dark:hover:bg-transparent'
                  )}
                >
                  <SelectValue placeholder="Choose field" />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="z-[200]">
                  {CSV_LOCATION_FIELDS.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Map at least one column to{' '}
        <span className="font-medium text-foreground">Location Name</span>.
      </p>
    </div>
  )
}

interface LocationCsvImportFormProps {
  formId: string
  busy?: boolean
  variant?: 'dialog' | 'inline'
  onImport: (rows: LocationInput[]) => Promise<{ error: string | null }>
  onSuccess?: () => void
  onReadyChange?: (ready: boolean) => void
  onStageChange?: (stage: 'upload' | 'review') => void
}

function LocationCsvImportForm({
  formId,
  busy = false,
  variant = 'dialog',
  onImport,
  onSuccess,
  onReadyChange,
  onStageChange,
}: LocationCsvImportFormProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<CsvLocationColumn[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const canImport = csvHeaders.length > 0 && csvRows.length > 0
  const hasCsv = csvHeaders.length > 0

  useEffect(() => {
    onReadyChange?.(canImport)
  }, [canImport, onReadyChange])

  useEffect(() => {
    onStageChange?.(hasCsv ? 'review' : 'upload')
  }, [hasCsv, onStageChange])

  function loadFile(file: File) {
    setCsvFile(file)
    setFormError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseLocationCsvFile(String(reader.result ?? ''))
      if (parsed.error) {
        setCsvHeaders([])
        setCsvRows([])
        setMapping([])
        setFormError(parsed.error)
        return
      }
      setCsvHeaders(parsed.headers)
      setCsvRows(parsed.rows)
      setMapping(parsed.mapping)
    }
    reader.readAsText(file)
  }

  function clearFile() {
    setCsvFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setMapping([])
    setFormError(null)
  }

  function updateMapping(index: number, value: CsvLocationColumn) {
    setMapping((current) =>
      current.map((item, i) => (i === index ? value : item))
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canImport) return

    const { rows, error } = mapCsvRowsToLocations(csvRows, mapping)
    if (error) {
      setFormError(error)
      return
    }

    setFormError(null)
    const result = await onImport(rows)
    if (result.error) {
      setFormError(result.error)
      return
    }

    clearFile()
    onSuccess?.()
  }

  const preview = hasCsv ? (
    <LocationCsvPreview
      headers={csvHeaders}
      rows={csvRows}
      mapping={mapping}
      emptyMessage="Map at least one column to preview your locations here."
      className={variant === 'inline' ? 'min-h-[360px]' : undefined}
    />
  ) : null

  const showReviewLayout = hasCsv && variant === 'dialog'
  const showInlineReview = hasCsv && variant === 'inline'

  return (
    <form
      id={formId}
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(
        variant === 'dialog' &&
          showReviewLayout &&
          'flex min-h-0 flex-1 flex-col overflow-hidden'
      )}
    >
      <div
        className={cn(
          showReviewLayout
            ? 'grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,max-content)] xl:overflow-hidden'
            : 'space-y-5 px-6 py-5'
        )}
      >
        <div
          className={cn(
            'space-y-5',
            showReviewLayout && 'min-h-0 xl:overflow-y-auto xl:pr-1'
          )}
        >
          <LocationCsvUploadZone
            csvFile={csvFile}
            disabled={busy}
            onFileSelect={loadFile}
            onClear={clearFile}
          />

          {hasCsv ? (
            <LocationCsvMappingSection
              headers={csvHeaders}
              mapping={mapping}
              onMappingChange={updateMapping}
            />
          ) : null}

          {showInlineReview ? preview : null}

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
        </div>

        {showReviewLayout ? (
          <div className="min-h-0 min-w-0 xl:sticky xl:top-0 xl:self-start">
            {preview}
          </div>
        ) : null}
      </div>
    </form>
  )
}

export function LocationCsvImportDialog({
  open,
  saving,
  onOpenChange,
  onImport,
}: {
  open: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onImport: (rows: LocationInput[]) => Promise<{ error: string | null }>
}) {
  const formId = 'location-csv-import-form'
  const [canImport, setCanImport] = useState(false)
  const [stage, setStage] = useState<'upload' | 'review'>('upload')

  useEffect(() => {
    if (!open) {
      setCanImport(false)
      setStage('upload')
    }
  }, [open])

  const isReview = stage === 'review'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={isReview ? 'auto' : 'lg'}
        className={isReview ? 'min-w-[min(100%,24rem)]' : undefined}
        onPointerDownOutside={preventSelectDismiss}
        onFocusOutside={preventSelectDismiss}
      >
        <div
          className={cn(
            'flex flex-col',
            isReview && 'max-h-[calc(100svh-2rem)] min-h-0'
          )}
        >
          <DialogHeader>
            <DialogTitle>Import locations</DialogTitle>
            <DialogDescription>
              {isReview
                ? 'Map columns and preview your locations before importing.'
                : 'Upload a CSV file to add multiple locations at once.'}
            </DialogDescription>
          </DialogHeader>

          {open ? (
            <LocationCsvImportForm
              formId={formId}
              busy={saving}
              onImport={onImport}
              onSuccess={() => onOpenChange(false)}
              onReadyChange={setCanImport}
              onStageChange={setStage}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {isReview ? (
              <Button
                type="submit"
                form={formId}
                loading={saving}
                disabled={!canImport}
              >
                Import locations
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Inline CSV import for setup wizard. */
export function LocationCsvImportPanel({
  busy = false,
  onImport,
  onComplete,
}: {
  busy?: boolean
  onImport: (rows: LocationInput[]) => Promise<{ error: string | null }>
  onComplete?: () => void
}) {
  const formId = 'location-csv-import-inline'

  return (
    <div className="space-y-4">
      <LocationCsvImportForm
        formId={formId}
        variant="inline"
        busy={busy}
        onImport={onImport}
        onSuccess={onComplete}
      />
      <Button type="submit" form={formId} loading={busy}>
        Import locations
      </Button>
    </div>
  )
}
