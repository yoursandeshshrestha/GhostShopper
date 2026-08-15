import { CaretDown, DownloadSimple, FileText, FileXls } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OrgDashboardData } from '@/hooks/use-org-dashboard'
import { exportDashboardReport } from '@/lib/export-report'

export function DashboardExportMenu({
  data,
  orgName,
}: {
  data: OrgDashboardData
  orgName?: string | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <DownloadSimple />
          Export report
          <CaretDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() =>
            exportDashboardReport(data, 'csv', { orgName: orgName ?? null })
          }
        >
          <FileXls />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            exportDashboardReport(data, 'pdf', { orgName: orgName ?? null })
          }
        >
          <FileText />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
