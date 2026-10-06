import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { docsUrl } from '@/shared/docs-url'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { listPaymentCredentials, setPaymentCredential, type PaymentCredential } from '../../lib/api'
import { useAsync } from '../../lib/use-async'
import { useOrg } from '../../lib/org-context'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

const PROVIDERS: PaymentCredential['provider'][] = ['bancontact', 'sumup']
const PROVIDER_LABELS: Record<PaymentCredential['provider'], string> = {
  bancontact: 'Bancontact',
  sumup: 'SumUp',
}

export default function PaymentProvidersPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: credentials, loading, error, reload } = useAsync(
    () => (orgId ? listPaymentCredentials(orgId) : Promise.resolve([])),
    [orgId]
  )

  const [editing, setEditing] = useState<PaymentCredential['provider'] | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [sumupMerchantId, setSumupMerchantId] = useState('')
  const [environment, setEnvironment] = useState('prod')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function openEditor(provider: PaymentCredential['provider']) {
    setEditing(provider)
    setApiKey('')
    setSumupMerchantId('')
    setEnvironment('prod')
    setSaveError(null)
  }

  async function handleSave() {
    if (!orgId || !editing) return
    setSaving(true)
    setSaveError(null)
    try {
      const config: Record<string, unknown> =
        editing === 'bancontact' ? { apiKey, environment } : { merchantId: sumupMerchantId, apiKey }
      await setPaymentCredential(orgId, editing, config)
      setEditing(null)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const byProvider = new Map((credentials ?? []).map((c) => [c.provider, c]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.settingsNav.paymentProviders}</h2>
        <p className="text-sm text-muted-foreground">{m.paymentProvidersSubtitle(currentOrg?.name ?? m.thisOrg)}</p>
      </div>

      {error && <p className="text-sm text-destructive">{m.paymentProvidersLoadFailed(error)}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {loading &&
          PROVIDERS.map((provider) => (
            <Card key={provider}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        {!loading &&
          PROVIDERS.map((provider) => {
            const cred = byProvider.get(provider)
            return (
              <Card key={provider}>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>{PROVIDER_LABELS[provider]}</CardTitle>
                    <CardDescription>{provider}</CardDescription>
                  </div>
                  <Badge variant={cred?.configured ? 'default' : 'secondary'}>
                    {cred?.configured ? m.configured : m.notConfigured}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {m.providerHelp[provider]}{' '}
                    <a href={docsUrl(provider)} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">
                      {m.moreInfo}
                    </a>
                  </p>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => openEditor(provider)}>
                      {m.setKeys}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.keysTitle(editing ? PROVIDER_LABELS[editing] : '')}</DialogTitle>
            <DialogDescription>{m.keysEncrypted}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {editing === 'sumup' && (
              <div className="grid gap-2">
                <Label htmlFor="sumup-merchant">{m.merchantCode}</Label>
                <Input id="sumup-merchant" value={sumupMerchantId} onChange={(e) => setSumupMerchantId(e.target.value)} autoComplete="off" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="provider-api-key">{m.apiKey}</Label>
              <Input id="provider-api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" />
            </div>
            {editing === 'bancontact' && (
              <div className="grid gap-2">
                <Label>{m.environment}</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">{m.production}</SelectItem>
                    <SelectItem value="preprod">{m.preprod}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? m.busy : m.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
