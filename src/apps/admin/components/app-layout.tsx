import { Suspense } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from './app-sidebar'
import { AppFooter } from './app-footer'
import { BackupBanner } from './backup-banner'
import { DemoBanner } from './demo-banner'
import { FirstOrganization } from './first-organization'
import { NoMembership } from './no-membership'
import { ImportBanner } from './import-banner'
import { AppBrand } from '@/shared/app-brand'
import { useNeedsFirstOrganization, useNoMembership } from '../lib/first-organization'
import { OrgProvider, useOrg } from '../lib/org-context'
import { editableOnReplica } from '../lib/replica'
import { useWaiterOnly, WaiterOnly } from '@/shared/waiter-only'
import { ThemeProvider } from '../lib/theme'
import { SupportButton } from '@/shared/support/support-button'

// A fresh installation without an organization asks for its first one;
// someone who's a member of nothing (and may not create one) is told so;
// otherwise the page (plus the demo / unfinished-import banners).
function MainContent() {
  const needsFirst = useNeedsFirstOrganization()
  const noMembership = useNoMembership()
  const { currentOrg, isReplica: replica } = useOrg()
  const waiterOnly = useWaiterOnly(currentOrg?.id)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (needsFirst) return <FirstOrganization />
  if (noMembership) return <NoMembership />
  if (waiterOnly) return <WaiterOnly />
  return (
    <>
      <DemoBanner />
      <ImportBanner />
      <BackupBanner replica={replica} />
      {/* A backup is read-only: every control of a page that changes it is
          disabled (a disabled fieldset), so nobody fills in a form for nothing.
          Route components are lazy-loaded (see router.tsx) - this Suspense
          boundary covers the swap between them. */}
      <fieldset disabled={replica && !editableOnReplica(pathname)} className="contents">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </fieldset>
    </>
  )
}

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
                <AppBrand className="ml-auto" />
                <SupportButton screen="console" className="ml-2" />
              </header>
              <main className="flex-1 p-6">
                <MainContent />
              </main>
              <AppFooter />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </OrgProvider>
    </ThemeProvider>
  )
}
