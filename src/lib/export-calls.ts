import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OrgCall } from '@/types/org'
import { CALL_STATUS_LABELS } from '@/types/org'
import { formatDateTimeShort } from '@/lib/datetime'
import { downloadCsv, pdfTableHeadStyles } from '@/lib/export-report'

export type CallsExportFormat = 'csv' | 'pdf'

type PdfDoc = jsPDF & { lastAutoTable: { finalY: number } }

const CALL_HEADERS = [
  'Location',
  'Status',
  'Score',
  'Human reviewed',
  'Flagged',
  'Started',
  'Completed',
  'Notes',
  'Call summary',
  'Coaching summary',
] as const

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function rowToCsv(cells: (string | number | null | undefined)[]) {
  return cells.map(escapeCsvValue).join(',')
}

function rowsToCsv(headers: string[], rows: string[][]) {
  return [rowToCsv(headers), ...rows.map((row) => rowToCsv(row))].join('\n')
}

function buildCallRows(calls: OrgCall[]) {
  return calls.map((call) => [
    call.locationName,
    CALL_STATUS_LABELS[call.status],
    call.score == null ? '' : String(call.score),
    call.humanReviewed ? 'Yes' : 'No',
    call.flaggedForReview ? 'Yes' : 'No',
    call.startedAt ? formatDateTimeShort(call.startedAt) : '',
    call.completedAt ? formatDateTimeShort(call.completedAt) : '',
    call.notes ?? '',
    call.callSummary ?? '',
    call.coachingSummary ?? '',
  ])
}

function buildCallsCsv(calls: OrgCall[]) {
  const csvHeaders = ['Call ID', ...CALL_HEADERS]
  const rows = calls.map((call) => [
    call.id,
    ...buildCallRows([call])[0],
  ])
  return rowsToCsv(csvHeaders, rows)
}

function averageScore(calls: OrgCall[]) {
  const scored = calls.filter((call) => call.score != null)
  if (scored.length === 0) return null
  const total = scored.reduce((sum, call) => sum + (call.score as number), 0)
  return Math.round((total / scored.length) * 10) / 10
}

function buildCallsPdf(calls: OrgCall[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as PdfDoc

  const generatedAt = formatDateTimeShort(new Date().toISOString())
  const awaiting = calls.filter((call) => call.status === 'awaiting_review').length
  const avg = averageScore(calls)

  doc.setFontSize(16)
  doc.text('GhostShopper calls report', 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Generated: ${generatedAt}`, 14, 23)
  doc.text(`Total calls: ${calls.length}`, 14, 28)
  doc.text(`Awaiting review: ${awaiting}`, 80, 28)
  doc.text(
    `Average score: ${avg == null ? '—' : avg}`,
    140,
    28
  )
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 34,
    head: [Array.from(CALL_HEADERS)],
    body: buildCallRows(calls),
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles: pdfTableHeadStyles,
    columnStyles: {
      7: { cellWidth: 28 },
      8: { cellWidth: 36 },
      9: { cellWidth: 36 },
    },
    margin: { left: 14, right: 14 },
  })

  return doc
}

function callsExportFilename(format: CallsExportFormat) {
  return `ghostshopper-calls-${new Date().toISOString().slice(0, 10)}.${format}`
}

export function exportCallsReport(calls: OrgCall[], format: CallsExportFormat) {
  if (calls.length === 0) return

  const filename = callsExportFilename(format)

  if (format === 'csv') {
    downloadCsv(filename, buildCallsCsv(calls))
    return
  }

  buildCallsPdf(calls).save(filename)
}

/** @deprecated Use exportCallsReport(calls, 'csv') */
export function exportCallsCsv(calls: OrgCall[]) {
  exportCallsReport(calls, 'csv')
}
