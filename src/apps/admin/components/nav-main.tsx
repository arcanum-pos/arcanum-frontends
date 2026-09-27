import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpen, LayoutDashboard, MonitorSmartphone, Package, Receipt, Server, Settings, TicketCheck, Users } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useMessages } from '@/shared/i18n'
import { useVersionInfo } from '@/shared/source-url'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'reports', to: '/reports', icon: Receipt },
  { key: 'events', to: '/events', icon: TicketCheck },
  { key: 'products', to: '/products', icon: Package },
  { key: 'catalogs', to: '/catalogs', icon: BookOpen },
  { key: 'devices', to: '/devices', icon: MonitorSmartphone },
  { key: 'users', to: '/users', icon: Users },
  { key: 'settings', to: '/settings', icon: Settings },
] as const

export function NavMain() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { installer } = useVersionInfo()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={m.nav[item.key]}>
              <Link to={item.to}>
                <item.icon />
                <span>{m.nav[item.key]}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {installer && (
          // arcanum-installer behind arcanum-bff (self-hosted installations
          // only) — its own page, not a console route: a full page load.
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={m.installer}>
              <a href="/installer/">
                <Server />
                <span>{m.installer}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
