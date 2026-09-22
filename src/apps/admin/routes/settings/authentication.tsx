import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getIdentityProvider, setIdentityProvider } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'
import { CopyLinkButton } from '../../components/copy-link-button'

export default function AuthenticationPage() {
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
        <h2 className="text-lg font-medium">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Optioneel: laat leden van deze organisatie inloggen via een eigen identity provider (bv. Google Workspace,
          Microsoft Entra ID, Keycloak) in plaats van het platform-standaardaccount. Laat leeg om de standaard te
          blijven gebruiken.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Kon identity provider niet laden: {error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Identity provider</CardTitle>
            <CardDescription>
              {loading ? 'Laden...' : idp?.hasClientSecret ? 'Status: client-secret ingesteld' : 'Status: nog geen client-secret ingesteld'}
            </CardDescription>
          </div>
          {!loading && <Badge variant={idp?.issuerUrl ? 'default' : 'secondary'}>{idp?.issuerUrl ? 'Aangepast' : 'Platform-standaard'}</Badge>}
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
                <Label htmlFor="idp-issuer-url">Issuer-URL</Label>
                <Input id="idp-issuer-url" placeholder="https://..." value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-client-id">Client-ID voor device code flow</Label>
                <Input id="idp-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-client-secret">Client-secret</Label>
                <Input id="idp-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" />
                <p className="text-sm text-muted-foreground">Alleen invullen om te wijzigen.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="idp-authcode-client-id">Client-ID voor authorization code flow (optioneel)</Label>
                <Input
                  id="idp-authcode-client-id"
                  value={authCodeClientId}
                  onChange={(e) => setAuthCodeClientId(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">
                  Alleen nodig als deze identity provider een aparte client per flow vereist. Leeg = gebruik de client
                  hierboven voor beide.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-authcode-client-secret">Client-secret</Label>
                <Input
                  id="idp-authcode-client-secret"
                  type="password"
                  value={authCodeClientSecret}
                  onChange={(e) => setAuthCodeClientSecret(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-sm text-muted-foreground">
                  Alleen invullen om te wijzigen ({idp?.hasAuthCodeClientSecret ? 'momenteel ingesteld' : 'momenteel niet ingesteld'}).
                </p>
              </div>

              {currentOrg?.customDomain && (authCodeClientId || idp?.authCodeClientId) && (
                <p className="rounded-md border border-amber-600/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-300">
                  Deze organisatie heeft een aangepast domein ({currentOrg.customDomain}) en een eigen client voor
                  authorization code flow — vergeet niet om{' '}
                  <code className="rounded bg-muted px-1">https://{currentOrg.customDomain}/callback</code> te
                  registreren als toegestane redirect-URI bij deze identity provider zelf.
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor="idp-scopes">Scopes (optioneel)</Label>
                <Input
                  id="idp-scopes"
                  placeholder="openid profile email offline_access"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">
                  Spatie-gescheiden — standaard 'openid profile email offline_access'. Google accepteert geen
                  'offline_access'; gebruik dan bv. 'openid profile email'.
                </p>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && !saveError && <p className="text-sm text-muted-foreground">Opgeslagen.</p>}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Bezig...' : 'Opslaan'}
          </Button>
        </CardFooter>
      </Card>

      {deviceFlowUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Aanmeldlinks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">Gebruik deze link om aan te melden op een toestel:</p>
              <div className="flex items-center gap-1">
                <code className="w-fit rounded bg-muted px-2 py-1 text-sm break-all">{deviceFlowUrl}</code>
                <CopyLinkButton text={deviceFlowUrl} />
              </div>
            </div>
            {consoleFlowUrl && (
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">Gebruik deze link om aan te melden in het beheerportaal:</p>
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
