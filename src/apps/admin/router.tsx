import { lazy } from 'react'
import { Navigate, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppLayout } from './components/app-layout'

// Every page is its own dynamic import — within the admin app itself,
// navigating to e.g. Payment Providers doesn't pull in the Users table
// code, same "only load what's needed" principle applied one level
// deeper than the kassa-vs-admin entry-point split (see vite.config.ts).
const DashboardPage = lazy(() => import('./routes/dashboard'))
const ReportsPage = lazy(() => import('./routes/reports'))
const EventsPage = lazy(() => import('./routes/events'))
const DevicesPage = lazy(() => import('./routes/devices'))
const UsersPage = lazy(() => import('./routes/users'))
const SettingsLayout = lazy(() => import('./routes/settings/layout'))
const AppearancePage = lazy(() => import('./routes/settings/appearance'))
const PreferencesPage = lazy(() => import('./routes/settings/preferences'))
const ProfilePage = lazy(() => import('./routes/settings/profile'))
const PaymentProvidersPage = lazy(() => import('./routes/settings/payment-providers'))
const NotificationsPage = lazy(() => import('./routes/settings/notifications'))
const AuthenticationPage = lazy(() => import('./routes/settings/authentication'))

const rootRoute = createRootRoute({ component: AppLayout })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/dashboard" />,
})

const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: DashboardPage })
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage })
const eventsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/events', component: EventsPage })
const devicesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/devices', component: DevicesPage })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: UsersPage })

const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsLayout })
const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  component: () => <Navigate to="/settings/appearance" />,
})
const appearanceRoute = createRoute({ getParentRoute: () => settingsRoute, path: '/appearance', component: AppearancePage })
const preferencesRoute = createRoute({ getParentRoute: () => settingsRoute, path: '/preferences', component: PreferencesPage })
const profileRoute = createRoute({ getParentRoute: () => settingsRoute, path: '/profile', component: ProfilePage })
const paymentProvidersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/payment-providers',
  component: PaymentProvidersPage,
})
const notificationsRoute = createRoute({ getParentRoute: () => settingsRoute, path: '/notifications', component: NotificationsPage })
const authenticationRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/authentication',
  component: AuthenticationPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  reportsRoute,
  eventsRoute,
  devicesRoute,
  usersRoute,
  settingsRoute.addChildren([
    settingsIndexRoute,
    appearanceRoute,
    preferencesRoute,
    profileRoute,
    paymentProvidersRoute,
    notificationsRoute,
    authenticationRoute,
  ]),
])

// In production this app is reached at questo-bff's /console (see
// questo-bff/src/index.ts) — the browser's real URL bar needs that prefix
// so a page reload/deep link resolves correctly, hence the basepath. Local
// `npm run dev` serves this app at its own root instead (no BFF in front
// of it), so it must NOT have the prefix there.
export const router = createRouter({ routeTree, basepath: import.meta.env.PROD ? '/console' : '/' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
