import { LayoutDashboard, Settings, Users } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'

// This is a proof-of-shape shell, not the real admin UI — it exists to
// confirm the shadcn/Vite/multi-entry setup actually renders end to end.
// The real panels (organizations, members, devices, identity providers,
// payment credentials — currently in webapp/src/pages/admin-org.astro)
// get ported in as their own routes here.
const NAV_ITEMS = [
  { title: 'Overzicht', icon: LayoutDashboard },
  { title: 'Leden', icon: Users },
  { title: 'Instellingen', icon: Settings },
]

function App() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <span className="px-2 text-sm font-semibold">Questo Beheerportaal</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Organisatie</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Beheerportaal</span>
          </header>
          <main className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Setup werkt</CardTitle>
                <CardDescription>
                  Vite + React + Tailwind v4 + shadcn/ui, gebundeld als het "admin" entry-point.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Volgende stap: de echte panelen (organisaties, leden, toestellen, identity providers,
                  betaalproviders) overzetten uit <code>webapp/src/pages/admin-org.astro</code>.
                </p>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
