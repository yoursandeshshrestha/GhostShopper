import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OrgDashboardData } from '@/hooks/use-org-dashboard'
import {
  buildDashboardReport,
  dashboardReportFilename,
  type DashboardReportFormat,
  type DashboardReportModel,
} from '@/lib/dashboard-report'

type PdfDoc = jsPDF & { lastAutoTable: { finalY: number } }

export const pdfTableHeadStyles = {
  fillColor: [229, 231, 235] as [number, number, number],
  textColor: [55, 65, 81] as [number, number, number],
  fontStyle: 'bold' as const,
}

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

function section(title: string, csv: string) {
  return [`# ${title}`, csv].join('\n')
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, csv: string) {
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}

function buildDashboardReportCsv(report: DashboardReportModel) {
  return [
    section(
      'GhostShopper dashboard report',
      rowsToCsv(
        ['Field', 'Value', 'Notes'],
        report.summary.map((row) => [row.field, row.value, row.notes])
      )
    ),
    '',
    section(
      'Weekly score trend',
      rowsToCsv(
        ['Period', 'Average score'],
        report.weeklyTrend.map((row) => [row.period, row.score])
      )
    ),
    '',
    section(
      'Monthly score trend',
      rowsToCsv(
        ['Period', 'Average score'],
        report.monthlyTrend.map((row) => [row.period, row.score])
      )
    ),
    '',
    section(
      'Yearly score trend',
      rowsToCsv(
        ['Period', 'Average score'],
        report.yearlyTrend.map((row) => [row.period, row.score])
      )
    ),
    '',
    section(
      'Network league table',
      rowsToCsv(
        [
          'Location',
          'Phone',
          'Timezone',
          'Country',
          'Status',
          'Last call',
          'Last score',
        ],
        report.locations.map((row) => [
          row.name,
          row.phone,
          row.timezone,
          row.country,
          row.status,
          row.lastCall,
          row.lastScore,
        ])
      )
    ),
  ].join('\n')
}

function addTrendTable(
  doc: PdfDoc,
  title: string,
  rows: Array<{ period: string; score: string }>,
  startY: number
) {
  doc.setFontSize(12)
  doc.text(title, 14, startY)

  autoTable(doc, {
    startY: startY + 4,
    head: [['Period', 'Average score']],
    body: rows.map((row) => [row.period, row.score]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: pdfTableHeadStyles,
    margin: { left: 14, right: 14 },
  })

  return doc.lastAutoTable.finalY + 8
}

function buildDashboardReportPdf(report: DashboardReportModel) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc

  doc.setFontSize(16)
  doc.text('GhostShopper dashboard report', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Organisation: ${report.orgName}`, 14, 26)
  doc.text(`Generated: ${report.summary[1]?.value ?? ''}`, 14, 31)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 38,
    head: [['Field', 'Value', 'Notes']],
    body: report.summary.map((row) => [row.field, row.value, row.notes]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: pdfTableHeadStyles,
    margin: { left: 14, right: 14 },
  })

  let cursorY = doc.lastAutoTable.finalY + 8
  cursorY = addTrendTable(doc, 'Weekly score trend', report.weeklyTrend, cursorY)

  if (cursorY > 240) {
    doc.addPage()
    cursorY = 20
  }
  cursorY = addTrendTable(doc, 'Monthly score trend', report.monthlyTrend, cursorY)

  if (cursorY > 240) {
    doc.addPage()
    cursorY = 20
  }
  cursorY = addTrendTable(doc, 'Yearly score trend', report.yearlyTrend, cursorY)

  if (cursorY > 220) {
    doc.addPage()
    cursorY = 20
  }

  doc.setFontSize(12)
  doc.text('Network league table', 14, cursorY)

  autoTable(doc, {
    startY: cursorY + 4,
    head: [[
      'Location',
      'Phone',
      'Timezone',
      'Country',
      'Status',
      'Last call',
      'Score',
    ]],
    body: report.locations.map((row) => [
      row.name,
      row.phone,
      row.timezone,
      row.country,
      row.status,
      row.lastCall,
      row.lastScore,
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: pdfTableHeadStyles,
    margin: { left: 14, right: 14 },
  })

  return doc
}

export function exportDashboardReport(
  data: OrgDashboardData,
  format: DashboardReportFormat,
  options?: { orgName?: string | null }
) {
  const report = buildDashboardReport(data, options)
  const filename = dashboardReportFilename(report, format)

  if (format === 'csv') {
    downloadCsv(filename, buildDashboardReportCsv(report))
    return
  }

  buildDashboardReportPdf(report).save(filename)
}
