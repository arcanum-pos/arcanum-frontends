import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { title: 'Appearance', to: '/settings/appearance' },
  { title: 'Preferences', to: '/settings/preferences' },
  { title: 'Profile', to: '/settings/profile' },
  { title: 'Payment Providers', to: '/settings/payment-providers' },
  { title: 'Notifications', to: '/settings/notifications' },
  { title: 'Authentication', to: '/settings/authentication' },
] as const

export default function SettingsLayout() {
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
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
