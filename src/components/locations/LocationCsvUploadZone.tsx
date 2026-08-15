import { useRef } from 'react'
import { FileXls as FileSpreadsheet, Upload, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { downloadLocationCsvTemplate } from '@/lib/location-csv-template'

interface LocationCsvUploadZoneProps {
  csvFile: File | null
  disabled?: boolean
  onFileSelect: (file: File) => void
  onClear: () => void
}

export function LocationCsvUploadZone({
  csvFile,
  disabled = false,
  onFileSelect,
  onClear,
}: LocationCsvUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = 'location-csv-upload'

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFileSelect(file)
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) onFileSelect(file)
  }

  function handleClear() {
    onClear()
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          Upload CSV
        </label>
        <button
          type="button"
          onClick={downloadLocationCsvTemplate}
          className="cursor-pointer text-sm text-primary hover:underline"
        >
          Download template
        </button>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        disabled={disabled}
        onChange={handleFileInput}
        className="hidden"
      />

      {csvFile ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{csvFile.name}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={handleClear}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove CSV file"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 transition-colors hover:border-primary/40 hover:bg-muted/20"
        >
          <Upload className="mb-2 size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Click to upload or drag and drop
          </span>
          <span className="mt-1 text-xs text-muted-foreground/80">
            Include a location name column. Phone, timezone, and country are
            optional.
          </span>
        </label>
      )}
    </div>
  )
}
