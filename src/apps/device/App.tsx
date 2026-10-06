import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeviceLogin } from '@/shared/device-login'
import { DEVICE_MESSAGES } from '@/shared/device-login/messages'
import { useMessages } from '@/shared/i18n'
import { KioskShell } from '@/shared/kiosk-shell'

// /device (arcanum-bff): signing in on this device with a phone only — the
// sign-in prompt offers the same next to the ordinary sign-in, so nobody
// has to know this address; it stays for bookmarks and printed instructions.
export default function App() {
  const m = useMessages(DEVICE_MESSAGES)
  return (
    <KioskShell maxWidth="max-w-md" devicePickers>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">{m.title}</CardTitle>
          <CardDescription>{m.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceLogin onSignedIn={() => (window.location.href = '/')} />
        </CardContent>
      </Card>
    </KioskShell>
  )
}
