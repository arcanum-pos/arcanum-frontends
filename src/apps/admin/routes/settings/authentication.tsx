import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useMessages } from '@/shared/i18n'
import { getIdentityProvider, setIdentityProvider } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'
import { CopyLinkButton } from '../../components/copy-link-button'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

export default function AuthenticationPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: idp, loading, error, reload } = useAsync(
    () => (orgId ? getIdentityProvider(orgId) : Promise.resolve(null)),
    [orgId]
  )

  const [issuerUrl, setIssuerUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scopes, setScopes] = useState('')
  const [authCodeClientId, setAuthCodeClientId] = useState('')
  const [authCodeClientSecret, setAuthCodeClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Re-seed the form fields whenever a fresh load comes in (org switch, or
  // after a save's reload()) — never while the admin is mid-edit.
  useEffect(() => {
    if (!idp) return
    setIssuerUrl(idp.issuerUrl ?? '')
    setClientId(idp.clientId ?? '')
    setClientSecret('')
    setScopes(idp.scopes ?? '')
    setAuthCodeClientId(idp.authCodeClientId ?? '')
    setAuthCodeClientSecret('')
  }, [idp])

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await setIdentityProvider(orgId, {
        issuerUrl: issuerUrl || undefined,
        clientId: clientId || undefined,
        clientSecret: clientSecret || undefined,
        scopes: scopes || undefined,
        authCodeClientId: authCodeClientId || undefined,
        authCodeClientSecret: authCodeClientSecret || undefined,
      })
      setSaved(true)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Login links carry no org identifier at all — a custom domain (which
  // requires this org to have its own identity provider, see Branding)
  // identifies the org by Host header alone, and an org on the shared
  // platform domain uses the exact same bare link as every other one
  // (org context comes from the admin-portal org picker / device
  // registration prompt afterward). window.location.origin is already
  // whichever domain this settings page itself was reached on, so it's
  // always the right one to show here.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const deviceFlowUrl = orgId ? `${origin}/device` : null
  const consoleFlowUrl = orgId ? `${origin}/console` : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.settingsNav.authentication}</h2>
        <p className="text-sm text-muted-foreground">{m.authenticationSubtitle}</p>
      </div>

      {error && <p className="text-sm text-destructive">{m.idpLoadFailed(error)}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{m.identityProvider}</CardTitle>
            <CardDescription>
              {loading ? m.loading : idp?.hasClientSecret ? m.clientSecretSet : m.clientSecretNotSet}
            </CardDescription>
          </div>
          {!loading && <Badge variant={idp?.issuerUrl ? 'default' : 'secondary'}>{idp?.issuerUrl ? m.custom : m.platformDefault}</Badge>}
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
                <Label htmlFor="idp-issuer-url">{m.issuerUrl}</Label>
                <Input id="idp-issuer-url" placeholder="https://..." value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-client-id">{m.deviceClientId}</Label>
                <Input id="idp-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-client-secret">{m.clientSecret}</Label>
                <Input id="idp-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" />
                <p className="text-sm text-muted-foreground">{m.fillInToChange}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="idp-authcode-client-id">{m.authCodeClientId}</Label>
                <Input
                  id="idp-authcode-client-id"
                  value={authCodeClientId}
                  onChange={(e) => setAuthCodeClientId(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">{m.authCodeClientHint}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-authcode-client-secret">{m.clientSecret}</Label>
                <Input
                  id="idp-authcode-client-secret"
                  type="password"
                  value={authCodeClientSecret}
                  onChange={(e) => setAuthCodeClientSecret(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-sm text-muted-foreground">{m.fillInToChangeState(!!idp?.hasAuthCodeClientSecret)}</p>
              </div>

              {currentOrg?.customDomain && (authCodeClientId || idp?.authCodeClientId) && (
                <p className="rounded-md border border-amber-600/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-300">
                  {m.redirectUriBefore(currentOrg.customDomain)}
                  <code className="rounded bg-muted px-1">https://{currentOrg.customDomain}/callback</code>
                  {m.redirectUriAfter}
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor="idp-scopes">{m.scopes}</Label>
                <Input
                  id="idp-scopes"
                  placeholder="openid profile email offline_access"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">{m.scopesHint}</p>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && !saveError && <p className="text-sm text-muted-foreground">{m.saved}</p>}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? m.busy : m.save}
          </Button>
        </CardFooter>
      </Card>

      {deviceFlowUrl && (
        <Card>
          <CardHeader>
            <CardTitle>{m.loginLinks}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">{m.deviceLinkHint}</p>
              <div className="flex items-center gap-1">
                <code className="w-fit rounded bg-muted px-2 py-1 text-sm break-all">{deviceFlowUrl}</code>
                <CopyLinkButton text={deviceFlowUrl} />
              </div>
            </div>
            {consoleFlowUrl && (
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">{m.consoleLinkHint}</p>
                <div className="flex items-center gap-1">
                  <code className="w-fit rounded bg-muted px-2 py-1 text-sm break-all">{consoleFlowUrl}</code>
                  <CopyLinkButton text={consoleFlowUrl} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
