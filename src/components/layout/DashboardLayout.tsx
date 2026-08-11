import type { ReactNode } from 'react'
import { AppSidebar } from './Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider className="bg-background">
        <AppSidebar />
        <SidebarInset className="m-2 ml-0 overflow-hidden rounded-xl bg-background ring-1 ring-border peer-data-[state=collapsed]:ml-2">
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
