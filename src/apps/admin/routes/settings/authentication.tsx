import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockIdentityProvider } from '../../lib/mock-data'

// TODO: replace mock state with getIdentityProvider/setIdentityProvider
// against /api/organizations/:orgId/identity-provider (same endpoints
// webapp's admin-org.astro Authentication panel already uses — see worker/
// src/organizations/identity-providers.ts for the save-time discovery/
// feasibility-gate this form's save action will hit).
export default function AuthenticationPage() {
  const [issuerUrl, setIssuerUrl] = useState(mockIdentityProvider.issuerUrl)
  const [clientId, setClientId] = useState(mockIdentityProvider.clientId)
  const [clientSecret, setClientSecret] = useState('')
  const [extraParam, setExtraParam] = useState(mockIdentityProvider.connectionName)

  const deviceFlowUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scouts-elewijt/device`

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

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Identity provider</CardTitle>
            <CardDescription>Status: {mockIdentityProvider.hasClientSecret ? 'client-secret ingesteld' : 'nog geen client-secret ingesteld'}</CardDescription>
          </div>
          <Badge variant={issuerUrl ? 'default' : 'secondary'}>{issuerUrl ? 'Aangepast' : 'Platform-standaard'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
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
        </CardContent>
        <CardFooter>
          <Button>Opslaan</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aanmeldlink voor toestellen</CardTitle>
          <CardDescription>Deel deze link om een kassa/CFD-toestel voor deze organisatie aan te melden.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="rounded bg-muted px-2 py-1 text-sm">{deviceFlowUrl}</code>
        </CardContent>
      </Card>
    </div>
  )
}
