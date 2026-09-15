import { Suspense } from 'react'
import { Outlet } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from './app-sidebar'
import { OrgProvider } from '../lib/org-context'
import { ThemeProvider } from '../lib/theme'

export function AppLayout() {
  return (
    <ThemeProvider>
      <OrgProvider>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
              </header>
              <main className="flex-1 p-6">
                {/* Route components are lazy-loaded (see router.tsx) — this
                    Suspense boundary covers the swap between them. */}
                <Suspense fallback={null}>
                  <Outlet />
                </Suspense>
              </main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </OrgProvider>
    </ThemeProvider>
  )
}
