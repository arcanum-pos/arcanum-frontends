import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeviceLogin } from '@/shared/device-login'
import { useMessages } from '@/shared/i18n'
import { KioskShell } from '@/shared/kiosk-shell'
import { LOGIN_PROMPT_MESSAGES } from './messages'

// Served as the body of a 401 at whatever protected path an unauthenticated
// browser requested — arcanum-bff returns this page verbatim at that same
// path (see index.ts), so window.location.pathname here is already the
// right returnTo with no server-side templating needed.
//
// Two ways in: signing in on this device (the instance's identity provider,
// /login), or with a phone (a QR code — the device grant, made by this
// page's script; see shared/device-login). Either way back to this page.
export default function App() {
  const m = useMessages(LOGIN_PROMPT_MESSAGES)
  const returnTo = window.location.pathname + window.location.search
  const href = returnTo && returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

  return (
    <KioskShell maxWidth="max-w-3xl" devicePickers>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{m.title}</CardTitle>
          <CardDescription>{m.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 md:gap-0 md:divide-x">
          <section className="flex flex-col gap-3 md:pr-6" data-testid="sign-in-here">
            <h2 className="font-heading text-base font-semibold">{m.hereTitle}</h2>
            <p className="text-sm text-muted-foreground">{m.hereHint}</p>
            <Button asChild className="w-full">
              <a href={href}>{m.signIn}</a>
            </Button>
          </section>
          <section className="flex flex-col items-center gap-3 border-t pt-6 md:border-t-0 md:pt-0 md:pl-6" data-testid="sign-in-phone">
            <h2 className="self-start font-heading text-base font-semibold">{m.phoneTitle}</h2>
            <p className="self-start text-sm text-muted-foreground">{m.phoneHint}</p>
            <DeviceLogin size={168} onSignedIn={() => window.location.replace(window.location.href)} />
          </section>
        </CardContent>
      </Card>
    </KioskShell>
  )
}
