import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpen, LayoutDashboard, MonitorSmartphone, Package, Receipt, Settings, TicketCheck, Users } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV_ITEMS = [
  { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { title: 'Rapporten', to: '/reports', icon: Receipt },
  { title: 'Events', to: '/events', icon: TicketCheck },
  { title: 'Producten', to: '/products', icon: Package },
  { title: 'Menukaarten', to: '/catalogs', icon: BookOpen },
  { title: 'Devices', to: '/devices', icon: MonitorSmartphone },
  { title: 'Users', to: '/users', icon: Users },
  { title: 'Settings', to: '/settings', icon: Settings },
] as const

export function NavMain() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <SidebarGroup>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={item.title}>
              <Link to={item.to}>
                <item.icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
