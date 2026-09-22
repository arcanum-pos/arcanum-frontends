import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  getGmailApiCredentials,
  getMailProvider,
  getSmtpCredentials,
  sendTestEmail,
  setGmailApiCredentials,
  setMailProvider,
  setSmtpCredentials,
  type MailProvider,
} from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'

const PLANNED_NOTIFICATIONS = [
  { id: 'invite', label: 'Nieuwe uitnodiging', description: 'E-mail wanneer iemand wordt uitgenodigd voor deze organisatie.' },
  { id: 'payment-failed', label: 'Mislukte betaling', description: 'E-mail bij een mislukte of verlopen betaling.' },
]

export default function NotificationsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null

  const { data: providerData, loading: providerLoading, error: providerError, reload: reloadProvider } = useAsync(
    () => (orgId ? getMailProvider(orgId) : Promise.resolve(null)),
    [orgId]
  )
  const { data: smtp, loading: smtpLoading, reload: reloadSmtp } = useAsync(
    () => (orgId ? getSmtpCredentials(orgId) : Promise.resolve(null)),
    [orgId]
  )
  const { data: gmailApi, loading: gmailApiLoading, reload: reloadGmailApi } = useAsync(
    () => (orgId ? getGmailApiCredentials(orgId) : Promise.resolve(null)),
    [orgId]
  )

  const loading = providerLoading || smtpLoading || gmailApiLoading

  const [provider, setProvider] = useState<MailProvider>('smtp')

  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')

  const [clientEmail, setClientEmail] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [impersonatedUser, setImpersonatedUser] = useState('')
  const [gmailFromName, setGmailFromName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Re-seed the form whenever a fresh load comes in (org switch, or after
  // a save's reload()) — never while the admin is mid-edit.
  useEffect(() => {
    if (providerData) setProvider(providerData.provider)
  }, [providerData])

  useEffect(() => {
    if (!smtp) return
    setHost(smtp.host ?? '')
    setPort(smtp.port ? String(smtp.port) : '')
    setUsername(smtp.username ?? '')
    setPassword('')
    setFromAddress(smtp.fromAddress ?? '')
    setFromName(smtp.fromName ?? '')
  }, [smtp])

  useEffect(() => {
    if (!gmailApi) return
    setClientEmail(gmailApi.clientEmail ?? '')
    setPrivateKey('')
    setImpersonatedUser(gmailApi.impersonatedUser ?? '')
    setGmailFromName(gmailApi.fromName ?? '')
  }, [gmailApi])

  function handleServiceAccountFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text)
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error('Bestand mist client_email of private_key')
        }
        setClientEmail(parsed.client_email)
        setPrivateKey(parsed.private_key)
      })
      .catch((err) => {
        setFileError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = ''
      })
  }

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await setMailProvider(orgId, provider)
      if (provider === 'smtp') {
        await setSmtpCredentials(orgId, {
          host: host || undefined,
          port: port ? Number(port) : undefined,
          username: username || undefined,
          password: password || undefined,
          fromAddress: fromAddress || undefined,
          fromName: fromName || undefined,
        })
      } else {
        await setGmailApiCredentials(orgId, {
          clientEmail: clientEmail || undefined,
          privateKey: privateKey || undefined,
          impersonatedUser: impersonatedUser || undefined,
          fromName: gmailFromName || undefined,
        })
      }
      setSaved(true)
      reloadProvider()
      reloadSmtp()
      reloadGmailApi()
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

      {providerError && <p className="text-sm text-destructive">Kon e-mailconfiguratie niet laden: {providerError}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>E-mailaccount</CardTitle>
            <CardDescription>
              {loading
                ? 'Laden...'
                : provider === 'smtp'
                  ? smtp?.hasPassword
                    ? 'Status: wachtwoord ingesteld'
                    : 'Status: nog geen wachtwoord ingesteld'
                  : gmailApi?.hasPrivateKey
                    ? 'Status: service account ingesteld'
                    : 'Status: nog geen service account ingesteld'}
            </CardDescription>
          </div>
          {!loading && (
            <Badge variant={smtp?.host || gmailApi?.hasPrivateKey ? 'default' : 'secondary'}>
              {smtp?.host || gmailApi?.hasPrivateKey ? 'Aangepast' : 'Platform-standaard'}
            </Badge>
          )}
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
              <div className="grid gap-2">
                <Label htmlFor="mail-provider">Verzendmethode</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as MailProvider)}>
                  <SelectTrigger id="mail-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="gmail_api">Gmail API (service account)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {provider === 'smtp' ? (
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
                      <Input id="smtp-from-name" placeholder="Arcanum" value={fromName} onChange={(e) => setFromName(e.target.value)} autoComplete="off" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-service-account">
                      Service-account JSON-bestand{' '}
                      <span className="font-normal text-muted-foreground">(uit Google Cloud Console — alleen invullen om te wijzigen)</span>
                    </Label>
                    <Input id="gmail-service-account" ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleServiceAccountFile} />
                    {fileError && <p className="text-sm text-destructive">{fileError}</p>}
                    {clientEmail && <p className="text-sm text-muted-foreground">Client e-mail: {clientEmail}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-impersonated-user">
                      Verzenden als <span className="font-normal text-muted-foreground">(Workspace-adres met domain-wide delegation)</span>
                    </Label>
                    <Input
                      id="gmail-impersonated-user"
                      placeholder="admin@jouwdomein.be"
                      value={impersonatedUser}
                      onChange={(e) => setImpersonatedUser(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-from-name">Afzendernaam</Label>
                    <Input id="gmail-from-name" placeholder="Arcanum" value={gmailFromName} onChange={(e) => setGmailFromName(e.target.value)} autoComplete="off" />
                  </div>
                </>
              )}

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
