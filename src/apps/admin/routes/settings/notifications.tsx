import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// Placeholder — depends on the SMTP-based email delivery work described in
// the platform-federation design doc (invites currently create a DB row
// and notify no one). Not implemented yet.
const PLANNED_NOTIFICATIONS = [
  { id: 'invite', label: 'Nieuwe uitnodiging', description: 'E-mail wanneer iemand wordt uitgenodigd voor deze organisatie.' },
  { id: 'payment-failed', label: 'Mislukte betaling', description: 'E-mail bij een mislukte of verlopen betaling.' },
]

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Wacht op de e-mailfunctionaliteit (SMTP-worker) — nog niet actief.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>E-mailmeldingen</CardTitle>
          <CardDescription>Voorbeeld van wat hier komt zodra e-mailverzending bestaat.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {PLANNED_NOTIFICATIONS.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <div>
                <Label className="font-medium">{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch disabled />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
