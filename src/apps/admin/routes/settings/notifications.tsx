import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
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
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

// A service-account file that isn't one: its own message (follows a
// language switch), or the browser's JSON.parse error as is.
type FileError = { kind: 'incomplete' } | { kind: 'unreadable'; detail: string }

export default function NotificationsPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
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
  const [fileError, setFileError] = useState<FileError | null>(null)
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
          setFileError({ kind: 'incomplete' })
          return
        }
        setClientEmail(parsed.client_email)
        setPrivateKey(parsed.private_key)
      })
      .catch((err) => {
        setFileError({ kind: 'unreadable', detail: err instanceof Error ? err.message : String(err) })
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
        <h2 className="text-lg font-medium">{m.settingsNav.notifications}</h2>
        <p className="text-sm text-muted-foreground">{m.notificationsSubtitle}</p>
      </div>

      {providerError && <p className="text-sm text-destructive">{m.mailLoadFailed(providerError)}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{m.mailAccount}</CardTitle>
            <CardDescription>
              {loading
                ? m.loading
                : provider === 'smtp'
                  ? smtp?.hasPassword
                    ? m.passwordSet
                    : m.passwordNotSet
                  : gmailApi?.hasPrivateKey
                    ? m.serviceAccountSet
                    : m.serviceAccountNotSet}
            </CardDescription>
          </div>
          {!loading && (
            <Badge variant={smtp?.host || gmailApi?.hasPrivateKey ? 'default' : 'secondary'}>
              {smtp?.host || gmailApi?.hasPrivateKey ? m.custom : m.platformDefault}
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
                <Label htmlFor="mail-provider">{m.sendMethod}</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as MailProvider)}>
                  <SelectTrigger id="mail-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="gmail_api">{m.gmailApiOption}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {provider === 'smtp' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="smtp-host">{m.host}</Label>
                      <Input id="smtp-host" placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} autoComplete="off" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtp-port">{m.port}</Label>
                      <Input id="smtp-port" placeholder="587" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} autoComplete="off" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp-username">{m.username}</Label>
                    <Input id="smtp-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp-password">
                      {m.password} <span className="font-normal text-muted-foreground">{m.passwordHint}</span>
                    </Label>
                    <Input id="smtp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="smtp-from-address">{m.fromAddress}</Label>
                      <Input id="smtp-from-address" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} autoComplete="off" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtp-from-name">{m.fromName}</Label>
                      <Input id="smtp-from-name" placeholder="Arcanum" value={fromName} onChange={(e) => setFromName(e.target.value)} autoComplete="off" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-service-account">
                      {m.serviceAccountFile}{' '}
                      <span className="font-normal text-muted-foreground">{m.serviceAccountFileHint}</span>
                    </Label>
                    <Input id="gmail-service-account" ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleServiceAccountFile} />
                    {fileError && (
                      <p className="text-sm text-destructive">{fileError.kind === 'incomplete' ? m.serviceAccountFileIncomplete : fileError.detail}</p>
                    )}
                    {clientEmail && <p className="text-sm text-muted-foreground">{m.clientEmail(clientEmail)}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-impersonated-user">
                      {m.sendAs} <span className="font-normal text-muted-foreground">{m.sendAsHint}</span>
                    </Label>
                    <Input
                      id="gmail-impersonated-user"
                      placeholder={m.sendAsPlaceholder}
                      value={impersonatedUser}
                      onChange={(e) => setImpersonatedUser(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gmail-from-name">{m.fromName}</Label>
                    <Input id="gmail-from-name" placeholder="Arcanum" value={gmailFromName} onChange={(e) => setGmailFromName(e.target.value)} autoComplete="off" />
                  </div>
                </>
              )}

              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && !saveError && <p className="text-sm text-muted-foreground">{m.saved}</p>}
            </>
          )}
        </CardContent>
        <CardFooter className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? m.busy : m.save}
          </Button>
          <Button variant="outline" onClick={handleTestSend} disabled={testing || loading}>
            {testing ? m.busy : m.sendTestMail}
          </Button>
          {testResult === 'ok' && <span className="text-sm text-muted-foreground">{m.testMailSent}</span>}
          {testResult === 'error' && <span className="text-sm text-destructive">{m.testMailFailed(testError ?? '')}</span>}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.mailNotifications}</CardTitle>
          <CardDescription>{m.mailNotificationsHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Object.entries(m.plannedNotifications).map(([id, item]) => (
            <div key={id} className="flex items-center justify-between gap-4">
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
