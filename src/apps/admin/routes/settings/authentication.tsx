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
  const [extraParam, setExtraParam] = useState('')
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
    setExtraParam(idp.connectionName ?? '')
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
        connectionName: extraParam || undefined,
      })
      setSaved(true)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const deviceFlowUrl = orgId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${orgId}/device`
    : null

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
                <Label htmlFor="idp-client-id">Client-ID</Label>
                <Input id="idp-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-client-secret">
                  Client-secret <span className="font-normal text-muted-foreground">(alleen invullen om te wijzigen)</span>
                </Label>
                <Input id="idp-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idp-extra-param">
                  Extra parameter <span className="font-normal text-muted-foreground">(optioneel, providerspecifiek — meestal leeg laten)</span>
                </Label>
                <Input id="idp-extra-param" value={extraParam} onChange={(e) => setExtraParam(e.target.value)} autoComplete="off" />
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
            <CardTitle>Aanmeldlink voor toestellen</CardTitle>
            <CardDescription>Deel deze link om een kassa/CFD-toestel voor deze organisatie aan te melden.</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 text-sm">{deviceFlowUrl}</code>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
