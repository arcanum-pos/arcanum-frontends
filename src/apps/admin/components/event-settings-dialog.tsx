import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useMessages } from '@/shared/i18n'
import {
  createOrderMode,
  deleteOrderMode,
  newSelfOrderCode,
  resetEventNumbers,
  updateEvent,
  updateOrderMode,
  type Event,
  type OrderMode,
  type OrderModeFields,
} from '../lib/api'
import type { CatalogSummary } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// Evenementen → "Instellen": an event's ordering modes (bestelwijzen: "Ter
// plaatse", "Take away", "Alleen aan de kassa", … — each its own menu, where
// it's used, how guests pay, ordering on a tab), its self-ordering (one link
// and QR code to print for all modes, a new link when the old one should stop
// working) and its own order numbers (start again at 1).
// DOMAIN_MODEL.md "Self-ordering and station screens".
const NONE = 'none'

type Messages = ReturnType<typeof useMessages<typeof ADMIN_ORG_MESSAGES.nl>>['events']

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
  const [newMode, setNewMode] = useState('')
  const [shownId, setShownId] = useState<string | null>(null)

  useEffect(() => {
    setCurrent(event)
    setError(null)
    setNewMode('')
    setShownId(null)
  }, [event])

  async function run(action: () => Promise<Event>) {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setCurrent(next)
      onChanged(next)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const url = current?.selfOrder?.code ? `${window.location.origin}/bestel/${current.selfOrder.code}` : ''
  const modes = current?.modes ?? []
  const qrModes = modes.filter((mode) => mode.selfOrder && mode.catalogId)
  const active = catalogs.filter((c) => !c.archived)

  // The mode shown (one at a time, chosen in the dropdown): the one picked,
  // else the first.
  const shown = modes.find((mode) => mode.id === shownId) ?? modes[0] ?? null
  const shownIndex = shown ? modes.indexOf(shown) : -1

  async function addMode() {
    if (!current || !newMode.trim()) return
    const name = newMode.trim()
    let added: Event | null = null
    if (
      await run(async () => {
        added = await createOrderMode(orgId, current.id, { name })
        return added
      })
    ) {
      setNewMode('')
      // The new one is shown, to set it up.
      const created = (added as Event | null)?.modes?.at(-1)
      if (created) setShownId(created.id)
    }
  }

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>{m.settingsTitle(current.name)}</DialogTitle>
              <DialogDescription>{m.settingsHint}</DialogDescription>
            </DialogHeader>
            {/* Wide: the event's own settings left, its ordering modes right; a phone: one under the other. */}
            <div className="grid gap-6 md:grid-cols-2 md:gap-8">
              <div className="grid content-start gap-5" data-testid="order-modes">
                <div className="grid gap-2">
                  <Label>{m.modes}</Label>
                  <p className="text-sm text-muted-foreground">{m.modesHint}</p>
                  {modes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{m.noModes}</p>
                  ) : (
                    <Select value={shown?.id} onValueChange={setShownId} disabled={busy}>
                      <SelectTrigger aria-label={m.modeChoose} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map((mode) => (
                          <SelectItem key={mode.id} value={mode.id}>
                            {mode.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {shown && (
                  <ModeCard
                    key={shown.id}
                    m={m}
                    mode={shown}
                    first={shownIndex === 0}
                    last={shownIndex === modes.length - 1}
                    catalogs={active}
                    busy={busy}
                    sms={!!current.sms}
                    directLink={qrModes.length > 1 && shown.selfOrder && url ? `${url}?m=${shown.id}` : null}
                    onChange={(fields) => {
                      // Stays the one shown, also when it moves away from the top.
                      setShownId(shown.id)
                      return run(() => updateOrderMode(orgId, current.id, shown.id, fields))
                    }}
                    onDelete={() => window.confirm(m.modeDeleteConfirm(shown.name)) && run(() => deleteOrderMode(orgId, current.id, shown.id)).then((ok) => ok && setShownId(null))}
                  />
                )}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void addMode()
                  }}
                >
                  <Input
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value)}
                    placeholder={m.addModePlaceholder}
                    aria-label={m.newMode}
                    list="order-mode-suggestions"
                    maxLength={40}
                  />
                  <datalist id="order-mode-suggestions">
                    {m.modeSuggestions.filter((s) => !modes.some((mode) => mode.name === s)).map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <Button type="submit" variant="outline" disabled={busy || !newMode.trim()}>
                    {m.addMode}
                  </Button>
                </form>
              </div>

              <div className="grid content-start gap-5 md:order-first">
                <div className="grid gap-2">
                  <label className="flex items-center justify-between gap-3 font-medium">
                    {m.selfOrderSwitch}
                    <Switch
                      checked={!!current.selfOrder?.enabled}
                      disabled={busy || qrModes.length === 0}
                      onCheckedChange={(on) => run(() => updateEvent(orgId, current.id, { selfOrderEnabled: on }))}
                      aria-label={m.selfOrder}
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">{qrModes.length === 0 ? m.selfOrderNeedsMode : m.selfOrderHint}</p>
                </div>

                {current.selfOrder?.enabled && url && (
                  <div className="grid gap-3 rounded-lg border p-3" data-testid="self-order-link">
                    <Label htmlFor="self-order-url">{m.link}</Label>
                    <CopyField id="self-order-url" value={url} m={m} />
                    <LinkName m={m} current={current.selfOrder.linkName ?? ''} busy={busy} onSave={(linkName) => run(() => updateEvent(orgId, current.id, { linkName }))} />
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-lg bg-white p-3">
                        <QRCodeSVG value={url} size={180} marginSize={1} title={m.qrAlt} />
                      </div>
                      <p className="text-center text-xs text-muted-foreground">{m.printHint}</p>
                    </div>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => window.confirm(m.newCodeConfirm) && run(() => newSelfOrderCode(orgId, current.id))}>
                      {m.newCode}
                    </Button>
                  </div>
                )}

                {modes.length > 0 && (
                  <div className="grid gap-2">
                    <label className="flex items-center justify-between gap-3 font-medium">
                      {m.kassaModes}
                      <Switch
                        checked={!!current.kassaModes}
                        disabled={busy}
                        onCheckedChange={(on) => run(() => updateEvent(orgId, current.id, { kassaModes: on }))}
                        aria-label={m.kassaModes}
                      />
                    </label>
                    <p className="text-sm text-muted-foreground">{m.kassaModesHint}</p>
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
              </div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// One ordering mode: its name, menu, where it's used — and with the QR, how
// guests pay, ordering on a tab, and (with more than one QR mode) a link
// straight to it, for a poster at the take-away window.
function ModeCard({
  m,
  mode,
  first,
  last,
  catalogs,
  busy,
  sms,
  directLink,
  onChange,
  onDelete,
}: {
  m: Messages
  mode: OrderMode
  first: boolean
  last: boolean
  catalogs: CatalogSummary[]
  busy: boolean
  sms: boolean
  directLink: string | null
  onChange: (fields: OrderModeFields) => Promise<boolean>
  onDelete: () => void
}) {
  const [name, setName] = useState(mode.name)
  useEffect(() => setName(mode.name), [mode.name])

  function saveName() {
    const trimmed = name.trim()
    if (!trimmed) setName(mode.name)
    else if (trimmed !== mode.name) void onChange({ name: trimmed })
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3" data-testid="order-mode" data-name={mode.name}>
      <div className="flex items-center gap-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-label={m.modeName}
          maxLength={40}
          className="font-medium"
        />
        <Button variant="ghost" size="icon" disabled={busy || first} onClick={() => onChange({ move: 'up' })} aria-label={m.modeUp}>
          <ChevronUp />
        </Button>
        <Button variant="ghost" size="icon" disabled={busy || last} onClick={() => onChange({ move: 'down' })} aria-label={m.modeDown}>
          <ChevronDown />
        </Button>
        <Button variant="ghost" size="icon" disabled={busy} onClick={onDelete} aria-label={m.modeDelete}>
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-sm font-normal">{m.modeMenu}</Label>
        <Select
          value={mode.catalogId ?? NONE}
          // A menu chosen where there was none: guests order with it.
          onValueChange={(v) => onChange(v === NONE ? { catalogId: null } : { catalogId: v, ...(mode.catalogId ? {} : { selfOrder: true }) })}
          disabled={busy}
        >
          <SelectTrigger aria-label={`${m.modeMenu} — ${mode.name}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{m.noMenu}</SelectItem>
            {catalogs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        {m.modeQr}
        <Switch checked={mode.selfOrder} disabled={busy || !mode.catalogId} onCheckedChange={(on) => onChange({ selfOrder: on })} aria-label={`${m.modeQr} — ${mode.name}`} />
      </label>
      {mode.selfOrder && (
        <div className="grid gap-2 rounded-md bg-muted/40 p-3" data-testid="pay-methods">
          <Label>{m.payMethods}</Label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {m.payCounter}
            <Switch checked={mode.payAtCounter} disabled={busy} onCheckedChange={(on) => onChange({ payAtCounter: on })} aria-label={m.payCounter} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {m.payBancontact}
            <Switch checked={mode.payBancontact} disabled={busy} onCheckedChange={(on) => onChange({ payBancontact: on })} aria-label={m.payBancontact} />
          </label>
          <p className="text-xs text-muted-foreground">{m.payBancontactHint}</p>
          <label className="mt-2 flex items-center justify-between gap-3 border-t pt-3 text-sm">
            {m.tabs}
            <Switch checked={mode.tabs} disabled={busy} onCheckedChange={(on) => onChange({ tabs: on })} aria-label={m.tabs} />
          </label>
          <p className="text-xs text-muted-foreground">{m.tabsHint}</p>
          {mode.tabs && (
            <>
              <label className="mt-1 flex items-center justify-between gap-3 text-sm">
                {m.tabContact}
                <Switch checked={!!mode.tabContact} disabled={busy} onCheckedChange={(on) => onChange({ tabContact: on })} aria-label={m.tabContact} />
              </label>
              <p className="text-xs text-muted-foreground">{m.tabContactHint}</p>
            </>
          )}
        </div>
      )}
      <div className="grid gap-1">
        <label className="flex items-center justify-between gap-3 text-sm">
          {m.modeSms}
          <Switch
            checked={!!mode.notifySms}
            disabled={busy || (!sms && !mode.notifySms)}
            onCheckedChange={(on) => onChange({ notifySms: on })}
            aria-label={`${m.modeSms} — ${mode.name}`}
          />
        </label>
        <p className="text-xs text-muted-foreground">{sms ? m.modeSmsHint : m.modeSmsOff}</p>
      </div>
      {directLink && (
        <div className="grid gap-1.5">
          <Label className="text-sm font-normal">{m.modeLink}</Label>
          <CopyField value={directLink} m={m} />
        </div>
      )}
    </div>
  )
}

// The name part of the readable link (/bestel/<name>-<4 characters>).
function LinkName({ m, current, busy, onSave }: { m: Messages; current: string; busy: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(current)
  useEffect(() => setName(current), [current])
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim() && name.trim() !== current) onSave(name.trim())
      }}
    >
      <Label htmlFor="self-order-link-name" className="text-sm font-normal">{m.linkName}</Label>
      <div className="flex gap-2">
        <Input id="self-order-link-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
        <Button type="submit" variant="outline" disabled={busy || !name.trim() || name.trim() === current}>
          {m.linkNameSave}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{m.linkNameHint}</p>
    </form>
  )
}

// A link shown whole (it wraps — a URL cut off can't be checked by eye), with a copy button.
function CopyField({ id, value, m }: { id?: string; value: string; m: Messages }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [value])
  return (
    <div className="flex items-start gap-2">
      <textarea
        id={id}
        readOnly
        rows={2}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs break-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          } catch {
            // the field stays selectable
          }
        }}
      >
        {copied ? m.copied : m.copy}
      </Button>
    </div>
  )
}
