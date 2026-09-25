import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getCustomDomain, removeCustomDomain, setCustomDomain, verifyCustomDomain } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'
import { CopyLinkButton } from '../../components/copy-link-button'

function isFullyActive(status: string | null, sslStatus: string | null): boolean {
  return status === 'active' && sslStatus === 'active'
}

export default function BrandingPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: domain, loading, error, reload } = useAsync(
    () => (orgId ? getCustomDomain(orgId) : Promise.resolve(null)),
    [orgId]
  )

  const [hostname, setHostname] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyErrors, setVerifyErrors] = useState<string[]>([])
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setHostname(domain?.customDomain ?? '')
    setSaveError(null)
    setVerifyErrors([])
  }, [domain])

  async function handleSave() {
    if (!orgId) return
    const trimmed = hostname.trim().toLowerCase()
    if (!trimmed) return
    setSaving(true)
    setSaveError(null)
    try {
      await setCustomDomain(orgId, trimmed)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleVerify() {
    if (!orgId) return
    setVerifying(true)
    setVerifyErrors([])
    try {
      const result = await verifyCustomDomain(orgId)
      setVerifyErrors([...result.verificationErrors, ...result.sslValidationErrors])
      reload()
    } catch (err) {
      setVerifyErrors([err instanceof Error ? err.message : String(err)])
    } finally {
      setVerifying(false)
    }
  }

  async function handleRemove() {
    if (!orgId) return
    if (!window.confirm(`${domain?.customDomain} verwijderen als aangepast domein?`)) return
    setRemoving(true)
    try {
      await removeCustomDomain(orgId)
      reload()
    } finally {
      setRemoving(false)
    }
  }

  const active = domain ? isFullyActive(domain.status, domain.sslStatus) : false

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Branding</h2>
        <p className="text-sm text-muted-foreground">
          Optioneel: maak deze organisatie bereikbaar op een eigen domeinnaam in plaats van het standaardadres van dit platform.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Kon domeininstellingen niet laden: {error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Aangepast domein</CardTitle>
            <CardDescription>
              {loading
                ? 'Laden...'
                : !domain?.customDomain
                  ? 'Nog geen domein ingesteld'
                  : active
                    ? 'Actief'
                    : 'Wachten op verificatie'}
            </CardDescription>
          </div>
          {!loading && domain?.customDomain && (
            <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Actief' : domain.status ?? 'Bezig'}</Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="custom-domain">Domeinnaam</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="custom-domain"
                    className="max-w-72"
                    placeholder="pos.mijnorganisatie.be"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    autoComplete="off"
                  />
                  <Button onClick={handleSave} disabled={saving || !hostname.trim()}>
                    {saving ? 'Bezig...' : domain?.customDomain ? 'Wijzigen' : 'Instellen'}
                  </Button>
                </div>
                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              </div>

              {domain?.customDomain && (
                <>
                  <div className="grid gap-1">
                    <p className="text-sm text-muted-foreground">
                      Maak bij je domeinprovider een CNAME-record aan dat <code className="rounded bg-muted px-1">{domain.customDomain}</code>{' '}
                      naar het volgende adres verwijst:
                    </p>
                    <div className="flex items-center gap-1">
                      <code className="w-fit rounded bg-muted px-2 py-1 text-sm break-all">{domain.cnameTarget}</code>
                      <CopyLinkButton text={domain.cnameTarget} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={handleVerify} disabled={verifying}>
                      {verifying ? 'Bezig...' : 'Verifiëren'}
                    </Button>
                  </div>

                  {active ? (
                    <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-950 dark:text-green-400">
                      <CheckCircle2 className="size-4 shrink-0" />
                      Domein geverifieerd en actief.
                    </div>
                  ) : (
                    !verifying &&
                    verifyErrors.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nog niet actief (status: {domain.status ?? '-'} / ssl: {domain.sslStatus ?? '-'}). Dit kan
                        enkele minuten duren nadat de CNAME zichtbaar is — klik op Verifiëren om de status te
                        vernieuwen.
                      </p>
                    )
                  )}
                  {verifyErrors.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-destructive">
                      {verifyErrors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-2 border-t pt-4">
                    <Button variant="ghost" className="text-destructive" onClick={handleRemove} disabled={removing}>
                      {removing ? 'Bezig...' : 'Verwijderen'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Vereist een eigen identity provider voor deze organisatie (zie Authentication) — leden melden zich na het
            instellen aan via dit domein zelf, niet meer via het standaardadres van dit platform.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
