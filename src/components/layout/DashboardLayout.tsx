import { useRef, type ReactNode } from 'react'
import { NewCallProvider } from '@/components/calls/NewCallProvider'
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner'
import { useAuth } from '@/components/auth/AuthProvider'
import { AppSidebar } from './Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MainScrollContext } from '@/contexts/MainScrollContext'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { isImpersonating } = useAuth()

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden bg-background">
        <NewCallProvider>
          <MainScrollContext.Provider value={scrollRef}>
            <AppSidebar />
            <SidebarInset className="h-svh min-h-0 overflow-hidden p-0">
              {isImpersonating ? <ImpersonationBanner /> : null}
              <div
                ref={scrollRef}
                data-main-scroll
                className="h-full min-h-0 overflow-y-auto"
              >
                {children}
              </div>
            </SidebarInset>
          </MainScrollContext.Provider>
        </NewCallProvider>
      </SidebarProvider>
    </TooltipProvider>
  )
}
