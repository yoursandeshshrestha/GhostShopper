import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CsvLocationColumn } from '@/lib/csv-locations'
import { cn } from '@/lib/utils'

const MAX_PREVIEW_ROWS = 100

interface LocationCsvPreviewProps {
  headers: string[]
  rows: string[][]
  mapping: CsvLocationColumn[]
  showHeader?: boolean
  emptyMessage?: string
  className?: string
}

export function LocationCsvPreview({
  headers,
  rows,
  mapping,
  showHeader = true,
  emptyMessage = 'Upload a CSV to preview your locations here.',
  className,
}: LocationCsvPreviewProps) {
  const previewColumns = useMemo(
    () =>
      headers
        .map((header, index) => ({
          header,
          index,
          mapped: mapping[index] ?? 'skip',
        }))
        .filter((column) => column.mapped !== 'skip'),
    [headers, mapping]
  )

  const locationCount = rows.length
  const title =
    locationCount > 0
      ? `CSV Preview (${locationCount} ${locationCount === 1 ? 'location' : 'locations'})`
      : 'CSV Preview'

  const visibleRows = rows.slice(0, MAX_PREVIEW_ROWS)
  const hiddenCount = locationCount - visibleRows.length
  const mappedCount = previewColumns.length

  if (headers.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] items-center justify-center px-6 py-12 text-center lg:min-h-[480px]',
          className
        )}
      >
        <p className="max-w-xs text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-max max-w-full flex-col overflow-hidden',
        showHeader &&
          'min-h-[280px] rounded-xl border border-border bg-card xl:min-h-[480px]',
        className
      )}
    >
      {showHeader ? (
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-base font-medium">{title}</h2>
          {hiddenCount > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Showing first {MAX_PREVIEW_ROWS} of {locationCount} rows
            </p>
          ) : null}
          {mappedCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {mappedCount} column{mappedCount === 1 ? '' : 's'} mapped to
              location fields
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        {previewColumns.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center px-6 py-10 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Map at least one CSV column to a location field to preview it
              here.
            </p>
          </div>
        ) : (
          <Table className="w-max min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                {previewColumns.map((column) => (
                  <TableHead
                    key={`${column.header}-${column.index}`}
                    className="h-10 whitespace-nowrap text-xs font-medium text-foreground"
                  >
                    {column.header || `Column ${column.index + 1}`}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {previewColumns.map((column) => {
                    const value = row[column.index] ?? ''

                    return (
                      <TableCell
                        key={`${rowIndex}-${column.index}`}
                        className="max-w-[220px] truncate py-2.5 text-sm text-foreground"
                        title={value || undefined}
                      >
                        {value || '—'}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showHeader && hiddenCount > 0 ? (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Showing first {MAX_PREVIEW_ROWS} of {locationCount} rows
          </p>
        ) : null}
      </div>
    </div>
  )
}
