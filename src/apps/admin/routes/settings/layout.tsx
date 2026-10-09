import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

const SETTINGS_NAV = [
  { key: 'appearance', to: '/settings/appearance' },
  { key: 'preferences', to: '/settings/preferences' },
  { key: 'profile', to: '/settings/profile' },
  { key: 'paymentProviders', to: '/settings/payment-providers' },
  { key: 'data', to: '/settings/data' },
] as const

export default function SettingsLayout() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
        {SETTINGS_NAV.map((item) => (
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
