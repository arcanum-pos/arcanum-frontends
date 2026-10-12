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
import { listPaymentCredentials, savePaymentKey, type BancontactAccount, type PaymentCredential } from '../../lib/api'
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
  // Bancontact: the account the key pays out to, to confirm before it's kept.
  const [confirming, setConfirming] = useState<BancontactAccount | null>(null)

  function openEditor(provider: PaymentCredential['provider']) {
    setEditing(provider)
    setApiKey('')
    setSumupMerchantId('')
    // The environment the key was saved for, so a test key is set again as one.
    setEnvironment(credentials?.find((c) => c.provider === provider)?.environment ?? 'prod')
    setSaveError(null)
    setConfirming(null)
  }

  async function handleSave() {
    if (!orgId || !editing) return
    setSaving(true)
    setSaveError(null)
    try {
      // First: which account is it? Then, confirmed: kept.
      const config = editing === 'bancontact' ? { apiKey, environment } : { merchantId: sumupMerchantId, apiKey }
      const result = await savePaymentKey(orgId, editing, { ...config, ...(confirming ? { confirmMerchantId: confirming.merchantId } : {}) })
      if ('confirm' in result) {
        setConfirming(result.confirm)
        return
      }
      setEditing(null)
      setConfirming(null)
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
                  <div className="flex flex-wrap justify-end gap-1">
                    {/* A test key takes no real payments: flagged so it isn't mistaken for the real one. */}
                    {provider === 'bancontact' && cred?.configured && cred.environment === 'preprod' && (
                      <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" data-testid="bancontact-test">
                        {m.preprod}
                      </Badge>
                    )}
                    {provider === 'sumup' && cred?.configured && cred.account?.sandbox === true && (
                      <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" data-testid="sumup-test">
                        {m.sumupSandbox}
                      </Badge>
                    )}
                    <Badge variant={cred?.configured ? 'default' : 'secondary'}>{cred?.configured ? m.configured : m.notConfigured}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {provider === 'bancontact' && cred?.configured && (
                    <p className={`text-sm ${cred.account ? '' : 'text-destructive'}`} data-testid="bancontact-account">
                      {cred.account ? m.bancontactPaysTo(cred.account.name ?? cred.account.merchantId, cred.account.iban ?? '') : m.bancontactUnchecked}
                    </p>
                  )}
                  {provider === 'sumup' && cred?.configured && (
                    <p className={`text-sm ${cred.account ? '' : 'text-destructive'}`} data-testid="sumup-account">
                      {cred.account ? m.sumupAccount(cred.account.name ?? m.sumupNoName, cred.account.merchantId) : m.sumupUnchecked}
                    </p>
                  )}
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
                <Input
                  id="sumup-merchant"
                  value={sumupMerchantId}
                  onChange={(e) => {
                    setSumupMerchantId(e.target.value)
                    setConfirming(null)
                  }}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="provider-api-key">{m.apiKey}</Label>
              <Input
                id="provider-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setConfirming(null)
                }}
                autoComplete="new-password"
              />
            </div>
            {editing === 'bancontact' && (
              <div className="grid gap-2">
                <Label>{m.environment}</Label>
                <Select
                  value={environment}
                  onValueChange={(v) => {
                    setEnvironment(v)
                    setConfirming(null)
                  }}
                >
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
            {!confirming && <p className="text-xs text-muted-foreground">{editing === 'bancontact' ? m.bancontactCheckHint : m.sumupCheckHint}</p>}
            {confirming && (
              <div className="grid gap-1 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm" data-testid="account-confirm">
                <p className="font-medium">{editing === 'bancontact' ? m.bancontactConfirmTitle : m.sumupConfirmTitle}</p>
                <p>
                  <strong>{confirming.name ?? (editing === 'sumup' ? m.sumupNoName : '—')}</strong>
                  {confirming.iban ? ` · ${confirming.iban}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{editing === 'bancontact' ? m.bancontactConfirmHint(confirming.merchantId) : m.sumupConfirmHint(confirming.merchantId)}</p>
                {editing === 'bancontact' && environment === 'preprod' && <p className="text-xs font-medium">{m.bancontactTestNote}</p>}
                {editing === 'sumup' && confirming.sandbox === true && <p className="text-xs font-medium">{m.sumupSandboxNote}</p>}
              </div>
            )}
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </div>
          <DialogFooter>
            {confirming && (
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={saving}>
                {m.bancontactNotMine}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? m.busy : confirming ? m.bancontactYesSave : m.bancontactCheck}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
