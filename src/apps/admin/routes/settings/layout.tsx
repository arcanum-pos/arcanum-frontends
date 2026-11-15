import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'
import { useOrg } from '../../lib/org-context'
import { SETTINGS_ON_REPLICA } from '../../lib/replica'

const SETTINGS_NAV = [
  { key: 'appearance', to: '/settings/appearance' },
  { key: 'preferences', to: '/settings/preferences' },
  { key: 'profile', to: '/settings/profile' },
  { key: 'paymentProviders', to: '/settings/payment-providers' },
  { key: 'data', to: '/settings/data' },
  { key: 'backup', to: '/settings/backup' },
] as const

export default function SettingsLayout() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isReplica } = useOrg()
  const items = isReplica ? SETTINGS_NAV.filter((i) => (SETTINGS_ON_REPLICA as readonly string[]).includes(i.key)) : SETTINGS_NAV

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname === item.to ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {m.settingsNav[item.key]}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
