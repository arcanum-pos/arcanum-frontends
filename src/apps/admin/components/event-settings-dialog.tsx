import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useMessages } from '@/shared/i18n'
import { newSelfOrderCode, resetEventNumbers, updateEvent, type Event } from '../lib/api'
import type { CatalogSummary } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// Evenementen → "Instellen": an event's menu, its self-ordering (guests
// order with their phone: a link and its QR code to print, a new link when
// the old one should stop working) and its own order numbers (start again
// at 1). DOMAIN_MODEL.md "Self-ordering and station screens".
const NONE = 'none'

export function EventSettingsDialog({
  orgId,
  event,
  catalogs,
  onClose,
  onChanged,
}: {
  orgId: string
  event: Event | null
  catalogs: CatalogSummary[]
  onClose: () => void
  onChanged: (event: Event) => void
}) {
  const m = useMessages(ADMIN_ORG_MESSAGES).events
  const [current, setCurrent] = useState<Event | null>(event)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCurrent(event)
    setError(null)
    setCopied(false)
  }, [event])

  async function run(action: () => Promise<Event>) {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setCurrent(next)
      onChanged(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const url = current?.selfOrder?.code ? `${window.location.origin}/bestel/${current.selfOrder.code}` : ''
  const active = catalogs.filter((c) => !c.archived)

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>{m.settingsTitle(current.name)}</DialogTitle>
              <DialogDescription>{m.settingsHint}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label>{m.menu}</Label>
                <Select
                  value={current.catalogId ?? NONE}
                  onValueChange={(v) => run(() => updateEvent(orgId, current.id, { catalogId: v === NONE ? null : v, ...(v === NONE ? { selfOrderEnabled: false } : {}) }))}
                  disabled={busy}
                >
                  <SelectTrigger aria-label={m.menu}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{m.noMenu}</SelectItem>
                    {active.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="flex items-center justify-between gap-3 font-medium">
                  {m.selfOrderSwitch}
                  <Switch
                    checked={!!current.selfOrder?.enabled}
                    disabled={busy || !current.catalogId}
                    onCheckedChange={(on) => run(() => updateEvent(orgId, current.id, { selfOrderEnabled: on }))}
                    aria-label={m.selfOrder}
                  />
                </label>
                <p className="text-sm text-muted-foreground">{m.selfOrderHint}</p>
              </div>

              {current.selfOrder?.enabled && url && (
                <div className="grid gap-3 rounded-lg border p-3" data-testid="self-order-link">
                  <Label htmlFor="self-order-url">{m.link}</Label>
                  <div className="flex gap-2">
                    <Input id="self-order-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url)
                          setCopied(true)
                        } catch {
                          // the field stays selectable
                        }
                      }}
                    >
                      {copied ? m.copied : m.copy}
                    </Button>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-lg bg-white p-3">
                      <QRCodeSVG value={url} size={200} marginSize={1} title={m.qrAlt} />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">{m.printHint}</p>
                  </div>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => window.confirm(m.newCodeConfirm) && run(() => newSelfOrderCode(orgId, current.id))}>
                    {m.newCode}
                  </Button>
                </div>
              )}

              <div className="grid gap-2">
                <Label>{m.numbers}</Label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm" data-testid="last-number">{m.lastNumber(current.lastOrderNumber ?? 0)}</p>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => window.confirm(m.resetConfirm) && run(() => resetEventNumbers(orgId, current.id))}>
                    {m.resetNumbers}
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
