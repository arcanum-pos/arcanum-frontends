import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KioskShell } from '@/shared/kiosk-shell'

// Served as the body of a 401 at whatever protected path an unauthenticated
// browser requested — arcanum-bff returns this page verbatim at that same
// path (see index.ts), so window.location.pathname here is already the
// right returnTo with no server-side templating needed.
export default function App() {
  const returnTo = window.location.pathname
  const href = returnTo && returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

  return (
    <KioskShell>
      <Card>
        <CardHeader>
          <CardTitle>Aanmelden vereist</CardTitle>
          <CardDescription>Je moet aangemeld zijn om deze pagina te bekijken.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href={href}>Aanmelden om verder te gaan</a>
          </Button>
        </CardContent>
      </Card>
    </KioskShell>
  )
}
