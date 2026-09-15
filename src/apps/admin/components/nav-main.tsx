import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, MonitorSmartphone, Settings, TicketCheck, Users } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV_ITEMS = [
  { title: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { title: 'Events', to: '/events', icon: TicketCheck },
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
