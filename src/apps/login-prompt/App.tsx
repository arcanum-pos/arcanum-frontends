import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { KioskShell } from '@/shared/kiosk-shell'
import { LOGIN_PROMPT_MESSAGES } from './messages'

// Served as the body of a 401 at whatever protected path an unauthenticated
// browser requested — arcanum-bff returns this page verbatim at that same
// path (see index.ts), so window.location.pathname here is already the
// right returnTo with no server-side templating needed.
export default function App() {
  const m = useMessages(LOGIN_PROMPT_MESSAGES)
  const returnTo = window.location.pathname
  const href = returnTo && returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

  return (
    <KioskShell languagePicker>
      <Card>
        <CardHeader>
          <CardTitle>{m.title}</CardTitle>
          <CardDescription>{m.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href={href}>{m.signIn}</a>
          </Button>
        </CardContent>
      </Card>
    </KioskShell>
  )
}
