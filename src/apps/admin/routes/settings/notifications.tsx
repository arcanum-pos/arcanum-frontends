import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { getSmtpCredentials, sendTestEmail, setSmtpCredentials } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'

const PLANNED_NOTIFICATIONS = [
  { id: 'invite', label: 'Nieuwe uitnodiging', description: 'E-mail wanneer iemand wordt uitgenodigd voor deze organisatie.' },
  { id: 'payment-failed', label: 'Mislukte betaling', description: 'E-mail bij een mislukte of verlopen betaling.' },
]

export default function NotificationsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: smtp, loading, error, reload } = useAsync(
    () => (orgId ? getSmtpCredentials(orgId) : Promise.resolve(null)),
    [orgId]
  )

  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Re-seed the form whenever a fresh load comes in (org switch, or after
  // a save's reload()) — never while the admin is mid-edit.
  useEffect(() => {
    if (!smtp) return
    setHost(smtp.host ?? '')
    setPort(smtp.port ? String(smtp.port) : '')
    setUsername(smtp.username ?? '')
    setPassword('')
    setFromAddress(smtp.fromAddress ?? '')
    setFromName(smtp.fromName ?? '')
  }, [smtp])

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await setSmtpCredentials(orgId, {
        host: host || undefined,
        port: port ? Number(port) : undefined,
        username: username || undefined,
        password: password || undefined,
        fromAddress: fromAddress || undefined,
        fromName: fromName || undefined,
      })
      setSaved(true)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    if (!orgId) return
    setTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      await sendTestEmail(orgId)
      setTestResult('ok')
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          E-mailconfiguratie voor deze organisatie. Laat leeg om het platform-standaardaccount te blijven gebruiken.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Kon e-mailconfiguratie niet laden: {error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>SMTP-account</CardTitle>
            <CardDescription>
              {loading ? 'Laden...' : smtp?.hasPassword ? 'Status: wachtwoord ingesteld' : 'Status: nog geen wachtwoord ingesteld'}
            </CardDescription>
          </div>
          {!loading && <Badge variant={smtp?.host ? 'default' : 'secondary'}>{smtp?.host ? 'Aangepast' : 'Platform-standaard'}</Badge>}
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="smtp-host">Host</Label>
                  <Input id="smtp-host" placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} autoComplete="off" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-port">Poort</Label>
                  <Input id="smtp-port" placeholder="587" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-username">Gebruikersnaam</Label>
                <Input id="smtp-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-password">
                  Wachtwoord <span className="font-normal text-muted-foreground">(app-wachtwoord — alleen invullen om te wijzigen)</span>
                </Label>
                <Input id="smtp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="smtp-from-address">Afzenderadres</Label>
                  <Input id="smtp-from-address" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} autoComplete="off" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-from-name">Afzendernaam</Label>
                  <Input id="smtp-from-name" placeholder="Questo" value={fromName} onChange={(e) => setFromName(e.target.value)} autoComplete="off" />
                </div>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && !saveError && <p className="text-sm text-muted-foreground">Opgeslagen.</p>}
            </>
          )}
        </CardContent>
        <CardFooter className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Bezig...' : 'Opslaan'}
          </Button>
          <Button variant="outline" onClick={handleTestSend} disabled={testing || loading}>
            {testing ? 'Bezig...' : 'Verstuur testmail'}
          </Button>
          {testResult === 'ok' && <span className="text-sm text-muted-foreground">Testmail verstuurd — controleer je inbox.</span>}
          {testResult === 'error' && <span className="text-sm text-destructive">Mislukt: {testError}</span>}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-mailmeldingen</CardTitle>
          <CardDescription>Voorbeeld van welke meldingen hier komen — nog niet configureerbaar per type.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {PLANNED_NOTIFICATIONS.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <div>
                <Label className="font-medium">{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch disabled checked />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
