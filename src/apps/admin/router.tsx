import { lazy } from 'react'
import { Navigate, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppLayout } from './components/app-layout'

// Every page is its own dynamic import — within the admin app itself,
// navigating to e.g. Payment Providers doesn't pull in the Users table
// code, same "only load what's needed" principle applied one level
// deeper than the kassa-vs-admin entry-point split (see vite.config.ts).
const DashboardPage = lazy(() => import('./routes/dashboard'))
const EventsPage = lazy(() => import('./routes/events'))
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
const eventsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/events', component: EventsPage })
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
  eventsRoute,
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

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
