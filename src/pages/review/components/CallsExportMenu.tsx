import { CaretDown, DownloadSimple, FileText, FileXls } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportCallsReport } from '@/lib/export-calls'
import type { OrgCall } from '@/types/org'

export function CallsExportMenu({ calls }: { calls: OrgCall[] }) {
  if (calls.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <DownloadSimple />
          Export
          <CaretDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => exportCallsReport(calls, 'csv')}>
          <FileXls />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportCallsReport(calls, 'pdf')}>
          <FileText />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
