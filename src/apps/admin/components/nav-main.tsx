import { Link, useRouterState } from '@tanstack/react-router'
import { Armchair, BookOpen, IdCard, Landmark, LayoutDashboard, MonitorSmartphone, Package, Receipt, Server, Settings, TicketCheck, Users } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useMessages } from '@/shared/i18n'
import { useVersionInfo } from '@/shared/source-url'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'
import { useOrg } from '../lib/org-context'
import { NAV_ON_REPLICA } from '../lib/replica'

const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'reports', to: '/reports', icon: Receipt },
  { key: 'events', to: '/events', icon: TicketCheck },
  { key: 'products', to: '/products', icon: Package },
  { key: 'catalogs', to: '/catalogs', icon: BookOpen },
  { key: 'devices', to: '/devices', icon: MonitorSmartphone },
  { key: 'registers', to: '/registers', icon: Landmark },
  { key: 'tables', to: '/tables', icon: Armchair },
  { key: 'users', to: '/users', icon: Users },
  { key: 'staff', to: '/staff', icon: IdCard },
  { key: 'settings', to: '/settings', icon: Settings },
] as const

export function NavMain() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { installer } = useVersionInfo()
  const { capabilities, isReplica } = useOrg()
  // A backup is read-only: only what still works (lib/replica.ts); its settings open on the backup page.
  const items = isReplica ? NAV_ITEMS.filter((i) => (NAV_ON_REPLICA as readonly string[]).includes(i.key)) : NAV_ITEMS
  // The installer behind this installation, for its own admins only (a demo's
  // visitors never see it). A backend without `instanceAdmin` (older): as before.
  const showInstaller = installer && !!capabilities && capabilities.instanceAdmin !== false

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={m.nav[item.key]}>
              <Link to={isReplica && item.key === 'settings' ? '/settings/backup' : item.to}>
                <item.icon />
                <span>{m.nav[item.key]}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {showInstaller && (
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
