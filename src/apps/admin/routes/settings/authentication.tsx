import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getIdentityProvider, setIdentityProvider, setOrganizationSlug } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'
import { CopyLinkButton } from '../../components/copy-link-button'

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/

export default function AuthenticationPage() {
  const { currentOrg, updateCurrentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: idp, loading, error, reload } = useAsync(
    () => (orgId ? getIdentityProvider(orgId) : Promise.resolve(null)),
    [orgId]
  )

  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSaved, setSlugSaved] = useState(false)

  useEffect(() => {
    setSlug(currentOrg?.slug ?? '')
    setSlugError(null)
    setSlugSaved(false)
  }, [currentOrg?.id, currentOrg?.slug])

  async function handleSaveSlug() {
    if (!orgId) return
    const trimmed = slug.trim().toLowerCase()
    if (trimmed && !SLUG_RE.test(trimmed)) {
      setSlugError('Alleen kleine letters, cijfers en koppeltekens, niet aan begin/eind.')
      return
    }
    setSlugSaving(true)
    setSlugError(null)
    setSlugSaved(false)
    try {
      const updated = await setOrganizationSlug(orgId, trimmed)
      updateCurrentOrg({ slug: updated.slug })
      setSlug(updated.slug ?? '')
      setSlugSaved(true)
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : String(err))
    } finally {
      setSlugSaving(false)
    }
  }

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

  // Without an org-specific identity provider, an org's members authenticate
  // against the platform default anyway — so the shared, unprefixed routes
  // work identically to a slug-prefixed one and are simpler to share. The
  // slug only matters (and only gets shown) once this org has its own IDP.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const hasSpecificIdp = Boolean(idp?.issuerUrl)
  const orgSlugOrId = orgId ? encodeURIComponent(currentOrg?.slug || orgId) : null
  const deviceFlowUrl = orgId ? (hasSpecificIdp ? `${origin}/${orgSlugOrId}/device` : `${origin}/device`) : null
  const consoleFlowUrl = orgId ? (hasSpecificIdp ? `${origin}/${orgSlugOrId}/console` : `${origin}/console`) : null

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
            {hasSpecificIdp && (
              <div className="grid gap-2">
                <Label htmlFor="org-slug">
                  Slug <span className="font-normal text-muted-foreground">(optioneel, maakt de link hierboven leesbaar)</span>
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="org-slug"
                    className="max-w-64"
                    placeholder={orgId ?? ''}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    autoComplete="off"
                  />
                  <Button variant="secondary" onClick={handleSaveSlug} disabled={slugSaving}>
                    {slugSaving ? 'Bezig...' : 'Opslaan'}
                  </Button>
                </div>
                {slugError && <p className="text-sm text-destructive">{slugError}</p>}
                {slugSaved && !slugError && <p className="text-sm text-muted-foreground">Opgeslagen.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
