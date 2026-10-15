import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
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
// plaatse", "Take away", "Alleen aan de kassa", … — each its own menu,
// self-ordering with it, how guests pay, ordering on a tab, SMS), its
// self-ordering (one link and QR code to print for all modes, a new link when
// the old one should stop working), whether the kassa picks a mode, and its
// own order numbers (start again at 1). DOMAIN_MODEL.md "Self-ordering and
// station screens".
//
// Every setting is one Section — a title, its switch on the right, a short
// explanation under it — divided by a line: the same look everywhere.
const NONE = 'none'
// The dropdown's last entry: add an ordering mode.
const ADD = '__add'

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
  const [adding, setAdding] = useState(false)
  const [shownId, setShownId] = useState<string | null>(null)

  useEffect(() => {
    setCurrent(event)
    setError(null)
    setNewMode('')
    setAdding(false)
    setShownId(null)
  }, [event])

  async function run(action: () => Promise<Event>) {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setCurrent(next)
      onChanged(next)
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setBusy(false)
    }
  }

  const url = current?.selfOrder?.code ? `${window.location.origin}/bestel/${current.selfOrder.code}` : ''
  const modes = current?.modes ?? []
  const qrModes = modes.filter((mode) => mode.selfOrder && mode.catalogId)
  const active = catalogs.filter((c) => !c.archived)
  // The mode shown (one at a time, chosen in the dropdown): the one picked, else the first.
  const shown = modes.find((mode) => mode.id === shownId) ?? modes[0] ?? null
  const shownIndex = shown ? modes.indexOf(shown) : -1
  const asking = adding || modes.length === 0

  async function addMode() {
    if (!current || !newMode.trim()) return
    const next = await run(() => createOrderMode(orgId, current.id, { name: newMode.trim() }))
    if (!next) return
    setNewMode('')
    setAdding(false)
    // The new one is shown, to set it up.
    const created = next.modes?.at(-1)
    if (created) setShownId(created.id)
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
              <div className="grid content-start gap-3 md:order-last" data-testid="order-modes">
                <Section title={m.modes} hint={m.modesHint} flush>
                  {modes.length === 0 && <p className="text-sm text-muted-foreground">{m.noModes}</p>}
                  {modes.length > 0 && (
                    <Select
                      value={adding ? ADD : shown?.id}
                      onValueChange={(v) => {
                        if (v === ADD) setAdding(true)
                        else {
                          setAdding(false)
                          setShownId(v)
                        }
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger aria-label={m.modeChoose} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map((mode) => (
                          <SelectItem key={mode.id} value={mode.id}>
                            {mode.name}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={ADD}>
                          <Plus className="size-4" aria-hidden="true" />
                          {m.addModeOption}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Section>

                {asking ? (
                  <form
                    className="grid gap-2 rounded-lg border p-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void addMode()
                    }}
                  >
                    <Label htmlFor="new-order-mode">{m.newMode}</Label>
                    <Input
                      id="new-order-mode"
                      value={newMode}
                      onChange={(e) => setNewMode(e.target.value)}
                      placeholder={m.addModePlaceholder}
                      list="order-mode-suggestions"
                      maxLength={40}
                      autoFocus={adding}
                    />
                    <datalist id="order-mode-suggestions">
                      {m.modeSuggestions.filter((s) => !modes.some((mode) => mode.name === s)).map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <div className="flex justify-end gap-2">
                      {modes.length > 0 && (
                        <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                          {m.cancel}
                        </Button>
                      )}
                      <Button type="submit" disabled={busy || !newMode.trim()}>
                        {m.addMode}
                      </Button>
                    </div>
                  </form>
                ) : (
                  shown && (
                    <ModeCard
                      key={shown.id}
                      m={m}
                      mode={shown}
                      first={shownIndex === 0}
                      last={shownIndex === modes.length - 1}
                      catalogs={active}
                      busy={busy}
                      sms={!!current.sms}
                      directLink={qrModes.length > 1 && shown.selfOrder && url ? `${url}?m=${shortModeId(shown.id)}` : null}
                      onChange={(fields) => {
                        // Stays the one shown, also when it moves away from the top.
                        setShownId(shown.id)
                        return run(() => updateOrderMode(orgId, current.id, shown.id, fields)).then(Boolean)
                      }}
                      onDelete={() => window.confirm(m.modeDeleteConfirm(shown.name)) && run(() => deleteOrderMode(orgId, current.id, shown.id)).then((next) => next && setShownId(null))}
                    />
                  )
                )}
              </div>

              <div className="grid content-start divide-y">
                <Section
                  title={m.selfOrderSwitch}
                  // Switching it on makes a mode ready when there's none (the backend); only
                  // an org without any menu can't.
                  hint={active.length === 0 ? m.selfOrderNeedsCatalog : qrModes.length === 0 && !current.selfOrder?.enabled ? (modes.length ? m.selfOrderUsesMode : m.selfOrderMakesMode) : m.selfOrderHint}
                  control={
                    <Switch
                      checked={!!current.selfOrder?.enabled}
                      disabled={busy || (active.length === 0 && !current.selfOrder?.enabled)}
                      onCheckedChange={(on) => run(() => updateEvent(orgId, current.id, { selfOrderEnabled: on }))}
                      aria-label={m.selfOrder}
                    />
                  }
                />

                {current.selfOrder?.enabled && url && (
                  <Section title={m.link} testId="self-order-link">
                    <CopyField id="self-order-url" label={m.link} value={url} m={m} />
                    <LinkName m={m} current={current.selfOrder.linkName ?? ''} busy={busy} onSave={(linkName) => run(() => updateEvent(orgId, current.id, { linkName }))} />
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <div className="rounded-lg bg-white p-3">
                        <QRCodeSVG value={url} size={168} marginSize={1} title={m.qrAlt} />
                      </div>
                      <p className="text-center text-xs text-muted-foreground">{m.printHint}</p>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => window.confirm(m.newCodeConfirm) && run(() => newSelfOrderCode(orgId, current.id))}>
                        {m.newCode}
                      </Button>
                    </div>
                  </Section>
                )}

                {modes.length > 0 && (
                  <Section
                    title={m.kassaModes}
                    hint={m.kassaModesHint}
                    control={
                      <Switch
                        checked={!!current.kassaModes}
                        disabled={busy}
                        onCheckedChange={(on) => run(() => updateEvent(orgId, current.id, { kassaModes: on }))}
                        aria-label={m.kassaModes}
                      />
                    }
                  />
                )}

                <Section
                  title={m.numbers}
                  control={
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => window.confirm(m.resetConfirm) && run(() => resetEventNumbers(orgId, current.id))}>
                      {m.resetNumbers}
                    </Button>
                  }
                >
                  <p className="text-sm" data-testid="last-number">{m.lastNumber(current.lastOrderNumber ?? 0)}</p>
                </Section>
              </div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// A mode's id in a direct link: its first 8 characters are enough within an
// event (the self-order page matches on them) — a link that fits on a line.
const shortModeId = (id: string) => id.slice(0, 8)

// One setting: a title with its control on the right, a short explanation,
// then whatever it holds. Sections sit in a list divided by lines.
function Section({
  title,
  hint,
  control,
  children,
  testId,
  flush = false,
}: {
  title: string
  hint?: string
  control?: React.ReactNode
  children?: React.ReactNode
  testId?: string
  flush?: boolean
}) {
  return (
    <section className={`grid gap-2 ${flush ? '' : 'py-4 first:pt-0 last:pb-0'}`} data-testid={testId}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {control}
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

// A switch inside a section (one of its options): the same look as a section's own.
function Option({ label, checked, disabled, onChange, ariaLabel }: { label: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void; ariaLabel?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={ariaLabel ?? label} />
    </label>
  )
}

// One ordering mode: its name and place, its menu, self-ordering with it —
// and then how guests pay, ordering on a tab — an SMS when ready, and (with
// more than one QR mode) a link straight to it, for a poster at the
// take-away window.
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
    <div className="grid divide-y rounded-lg border px-3" data-testid="order-mode" data-name={mode.name}>
      <div className="flex items-center gap-1 py-3">
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

      <Section title={m.modeMenu}>
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
      </Section>

      <Section
        title={m.modeQr}
        control={<Switch checked={mode.selfOrder} disabled={busy || !mode.catalogId} onCheckedChange={(on) => onChange({ selfOrder: on })} aria-label={`${m.modeQr} — ${mode.name}`} />}
      />

      <Section
        title={m.modeAtTable}
        hint={m.modeAtTableHint}
        control={<Switch checked={!!mode.atTable} disabled={busy || !mode.catalogId} onCheckedChange={(on) => onChange({ atTable: on })} aria-label={`${m.modeAtTable} — ${mode.name}`} />}
      />

      {mode.selfOrder && (
        <Section title={m.payMethods} hint={m.payBancontactHint} testId="pay-methods">
          <Option label={m.payCounter} checked={mode.payAtCounter} disabled={busy} onChange={(on) => onChange({ payAtCounter: on })} />
          <Option label={m.payBancontact} checked={mode.payBancontact} disabled={busy} onChange={(on) => onChange({ payBancontact: on })} />
        </Section>
      )}

      {mode.selfOrder && (
        <Section
          title={m.tabs}
          hint={m.tabsHint}
          control={<Switch checked={mode.tabs} disabled={busy} onCheckedChange={(on) => onChange({ tabs: on })} aria-label={m.tabs} />}
          testId="tab-settings"
        >
          {mode.tabs && (
            <>
              <Option label={m.tabContact} checked={!!mode.tabContact} disabled={busy} onChange={(on) => onChange({ tabContact: on })} />
              <p className="text-xs leading-relaxed text-muted-foreground">{m.tabContactHint}</p>
            </>
          )}
        </Section>
      )}

      <Section
        title={m.modeSms}
        hint={sms ? m.modeSmsHint : m.modeSmsOff}
        control={
          <Switch
            checked={!!mode.notifySms}
            disabled={busy || (!sms && !mode.notifySms)}
            onCheckedChange={(on) => onChange({ notifySms: on })}
            aria-label={`${m.modeSms} — ${mode.name}`}
          />
        }
      />

      {directLink && (
        <Section title={m.modeLink}>
          <CopyField label={m.modeLink} value={directLink} m={m} />
        </Section>
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
      <p className="text-xs leading-relaxed text-muted-foreground">{m.linkNameHint}</p>
    </form>
  )
}

// A link shown whole — the full width, wrapping (a URL cut off can't be
// checked by eye) — with a copy button under it.
function CopyField({ id, label, value, m }: { id?: string; label: string; value: string; m: Messages }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [value])
  return (
    <div className="grid gap-1.5">
      <textarea
        id={id}
        aria-label={label}
        readOnly
        // As high as the link needs (field-sizing; else a guess at its lines).
        rows={Math.min(3, Math.ceil(value.length / 40))}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="field-sizing-content w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs break-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        variant="outline"
        size="sm"
        className="justify-self-end"
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
