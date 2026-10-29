import { EntranceScreen } from '@/shared/entrance-screen'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/shared/api-errors'
import { useMessages } from '@/shared/i18n'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { listStaff, staffHeaders, type StaffMember } from '@/shared/staff'
import { StaffButton, useChosenStaff } from '@/shared/staff-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { STATION_MESSAGES } from './messages'
import { Pickup } from './Pickup'
import { nextStatus, previousStatus, visibleTickets, type Ticket, type TicketStatus } from './lib'
import { iconSlot, showOrgIcons } from '@/shared/install'
import { SupportButton } from '@/shared/support/support-button'
import { listPrinters, setStationPrinter, usePrintRunner, type Printer } from '@/shared/printing'
import { PrinterButton } from '@/shared/printer-button'

// A station screen (device role 'station'): the prep tickets (bonnen) of the
// one station this device is linked to, in columns by status — DOMAIN_MODEL.md
// "Self-ordering and station screens". Tap a ticket's button to move it on:
// ordered → in progress → ready → delivered. Only paid orders by default
// (the toggle shows unpaid ones too); delivered ones only when asked.
// Live: the notification socket says "tab X changed", then this screen
// fetches its tickets again — never polling.

const FILTERS_KEY = 'arcanum-station-filters'

function storedFilters(): { onlyPaid: boolean; showDelivered: boolean; onlyMine: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(FILTERS_KEY) || 'null')
    return { onlyPaid: value?.onlyPaid !== false, showDelivered: value?.showDelivered === true, onlyMine: value?.onlyMine === true }
  } catch {
    return { onlyPaid: true, showDelivered: false, onlyMine: false }
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data as T
}

const COLUMNS: TicketStatus[] = ['ordered', 'in_progress', 'ready', 'delivered']

// The entrance screen hears tables (and tabs) change over this device's socket.
const subscriptions = new Map<string, (onChange: () => void) => () => void>()
function entranceSubscribe(terminalId: string) {
  if (!subscriptions.has(terminalId))
    subscriptions.set(terminalId, (onChange) => {
      const socket = connectNotifications(terminalId, { tables_changed: onChange, tabs_changed: onChange })
      return () => socket.close()
    })
  return subscriptions.get(terminalId)!
}

// This page as the pickup screen: asked in the address (the station
// screen's own second window), or the device is one (paired as such).
const askedPickup = () => new URLSearchParams(window.location.search).get('view') === 'pickup'

// The pickup screen in its own window, on the second screen when the browser can say where.
async function openPickupWindow() {
  let features = 'popup,width=1280,height=800'
  const getScreenDetails = (window as any).getScreenDetails
  if (typeof getScreenDetails === 'function') {
    try {
      const details = await getScreenDetails()
      const other = details.screens.find((s: any) => s !== details.currentScreen)
      if (other) features = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`
    } catch {
      // opened where the browser likes
    }
  }
  window.open('/station.html?view=pickup', 'arcanum-pickup', features)?.focus()
}

export default function App() {
  const m = useMessages(STATION_MESSAGES)
  const [device, setDevice] = useState<{ orgId: string; terminalId: string; stationId: string | null; stationName: string; orgName: string; pickup: boolean; entrance: boolean } | null>(null)
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(storedFilters)
  const [busy, setBusy] = useState<string | null>(null)
  // The person chosen on this screen (staff), and a ticket being passed on.
  const staff = useChosenStaff(device?.orgId)
  const [passing, setPassing] = useState<Ticket | null>(null)
  // Re-renders the "x min ago" once a minute — a local clock, no server calls.
  const [, setNow] = useState(Date.now())
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped by every tap: a list that was already on its way from before the
  // tap is stale — it must not put the ticket back where it was.
  const generation = useRef(0)

  const load = useCallback(async () => {
    if (!device?.stationId || device.pickup) return
    const started = generation.current
    try {
      const path = `/api/organizations/${encodeURIComponent(device.orgId)}/stations/${encodeURIComponent(device.stationId)}/tickets${filters.showDelivered ? '?delivered=1' : ''}`
      const list = await call<Ticket[]>(path)
      if (started !== generation.current) return
      setTickets(list)
      setError(null)
    } catch (err) {
      setError(m.loadError(err instanceof Error ? err.message : String(err)))
    }
  }, [device, filters.showDelivered, m])

  // A burst of changes (several tickets at once): one reload — always with
  // the current filters (a reload scheduled just before "Toon afgeleverd"
  // was switched must not bring the old list back).
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  const scheduleLoad = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current)
    loadTimer.current = setTimeout(() => loadRef.current(), 200)
  }, [])

  useEffect(() => {
    getRegisteredTerminal('station').then(async (terminal) => {
      if (!terminal) {
        window.location.replace('/')
        return
      }
      const info = await call<{ station_id?: string; station_name?: string | null; view?: string | null }>(
        `/api/organizations/${encodeURIComponent(terminal.orgId)}/devices/${encodeURIComponent(terminal.terminalId)}`
      ).catch(() => ({}) as { station_id?: string; station_name?: string | null; view?: string | null })
      setDevice({
        orgId: terminal.orgId,
        terminalId: terminal.terminalId,
        stationId: info.station_id ?? null,
        stationName: info.station_name ?? terminal.name ?? '',
        orgName: terminal.orgName ?? '',
        pickup: info.view === 'pickup' || askedPickup(),
        // The entrance screen (release D): the promised tables, no station.
        entrance: info.view === 'tables',
      })
      // Its own icon: the prep station's, the pickup or entrance screen's.
      showOrgIcons(terminal.orgId, iconSlot('station', { stationId: info.station_id, view: info.view ?? (askedPickup() ? 'pickup' : null) }), info.station_name ?? terminal.name)
    })
    const clock = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(clock)
  }, [])

  // Its station's printer (arcanum/PRINTING.md): this screen prints the
  // station's tickets on it - told by `print_job` on the same socket.
  const [printers, setPrinters] = useState<Printer[]>([])
  const reloadPrinters = useCallback(() => {
    if (!device?.stationId || device.pickup || device.entrance) return
    listPrinters(device.orgId).then(setPrinters, () => {})
  }, [device])
  useEffect(reloadPrinters, [reloadPrinters])
  const printer = printers.find((p) => p.stations.some((s) => s.id === device?.stationId)) ?? null
  const printing = usePrintRunner(device?.orgId ?? null, printer)
  const poke = useRef(printing.poke)
  useEffect(() => {
    poke.current = printing.poke
  }, [printing.poke])

  useEffect(() => {
    if (!device || device.pickup || device.entrance) return
    load()
    const socket = connectNotifications(device.terminalId, { tabs_changed: () => scheduleLoad(), print_job: (msg) => poke.current(msg.printer_id) })
    // A push missed while the socket was down: reload when looked at again.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      socket.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [device, load, scheduleLoad])

  function setFilter(key: 'onlyPaid' | 'showDelivered' | 'onlyMine', value: boolean) {
    // A list already on its way was asked with the old filters: not used.
    generation.current++
    const next = { ...filters, [key]: value }
    setFilters(next)
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(next))
    } catch {
      // not remembered
    }
  }

  async function move(ticket: Ticket, status: TicketStatus) {
    if (!device) return
    setBusy(ticket.id)
    generation.current++
    try {
      await call(`/api/organizations/${encodeURIComponent(device.orgId)}/tickets/${encodeURIComponent(ticket.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...staffHeaders(device.orgId) },
        body: JSON.stringify({ status }),
      })
      setTickets((list) => list?.map((t) => (t.id === ticket.id ? { ...t, status } : t)) ?? list)
      scheduleLoad()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  // Passing a ticket on to someone else.
  async function passOn(ticket: Ticket, member: StaffMember) {
    if (!device) return
    setPassing(null)
    generation.current++
    try {
      await call(`/api/organizations/${encodeURIComponent(device.orgId)}/tickets/${encodeURIComponent(ticket.id)}/claim`, { method: 'POST', body: JSON.stringify({ staffId: member.id }) })
      scheduleLoad()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!device) return <p className="p-6 text-muted-foreground">{m.loading}</p>
  if (device.entrance) return <EntranceScreen orgId={device.orgId} subscribe={entranceSubscribe(device.terminalId)} />
  if (!device.stationId) return <p className="p-6" data-testid="no-station">{m.noStation}</p>
  if (device.pickup) return <Pickup device={{ ...device, stationId: device.stationId }} />

  const { shown, hiddenUnpaid } = visibleTickets(tickets ?? [], { ...filters, mine: filters.onlyMine ? (staff?.id ?? null) : null })
  const columns = COLUMNS.filter((c) => c !== 'delivered' || filters.showDelivered)

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight" data-testid="station-name">{device.stationName}</h1>
          <p className="truncate text-xs text-muted-foreground">{device.orgName}</p>
        </div>
        <StaffButton orgId={device.orgId} />
        {/* On the right, wrapping to the right: the filters as one group, the printer and ? together. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <Button variant="outline" size="sm" onClick={openPickupWindow} title={m.openPickupHint} data-testid="open-pickup">
              {m.openPickup}
            </Button>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={filters.onlyPaid} onCheckedChange={(v) => setFilter('onlyPaid', v)} aria-label={m.onlyPaid} />
              {m.onlyPaid}
            </label>
            {staff && (
              <label className="flex items-center gap-2 text-sm font-medium" title={m.onlyMineHint}>
                <Switch checked={filters.onlyMine} onCheckedChange={(v) => setFilter('onlyMine', v)} aria-label={m.onlyMine} />
                {m.onlyMine}
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={filters.showDelivered} onCheckedChange={(v) => setFilter('showDelivered', v)} aria-label={m.showDelivered} />
              {m.showDelivered}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <PrinterButton
              orgId={device.orgId}
              printers={printers}
              printer={printer}
              state={printing.state}
              failed={printing.failed}
              onRetry={printing.retry}
              onChoose={async (printerId) => {
                await setStationPrinter(device.orgId, device.stationId!, printerId).catch((err) => setError(err instanceof Error ? err.message : String(err)))
                reloadPrinters()
              }}
            />
            <SupportButton screen="station" />
          </div>
        </div>
      </header>
      {error && (
        <p className="bg-destructive/10 px-5 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {hiddenUnpaid > 0 && <p className="px-5 pt-3 text-xs text-muted-foreground" data-testid="hidden-unpaid">{m.hiddenUnpaid(hiddenUnpaid)}</p>}
      <main className="grid flex-1 gap-4 p-4 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" style={{ ['--cols' as string]: columns.length }}>
        {columns.map((status) => {
          const list = shown.filter((t) => t.status === status)
          return (
            <section key={status} className="flex min-w-0 flex-col gap-3" data-testid={`column-${status}`}>
              <h2 className="flex items-baseline justify-between text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {m.columns[status]}
                <span className="text-xs">{list.length}</span>
              </h2>
              {list.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{m.empty}</p>}
              {list.map((t) => (
                <TicketCard key={t.id} ticket={t} busy={busy === t.id} onMove={(s) => move(t, s)} onPassOn={() => setPassing(t)} />
              ))}
            </section>
          )
        })}
      </main>
      <PassOnDialog orgId={device.orgId} ticket={passing} onClose={() => setPassing(null)} onPick={passOn} />
    </div>
  )
}

// "Doorgeven…": who makes this ticket now.
function PassOnDialog({ orgId, ticket, onClose, onPick }: { orgId: string; ticket: Ticket | null; onClose: () => void; onPick: (ticket: Ticket, member: StaffMember) => void }) {
  const m = useMessages(STATION_MESSAGES)
  const [staff, setStaff] = useState<StaffMember[]>([])
  useEffect(() => {
    if (ticket) listStaff(orgId).then((r) => setStaff(r.staff)).catch(() => setStaff([]))
  }, [ticket, orgId])
  return (
    <Dialog open={!!ticket} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="pass-on">
        <DialogHeader>
          <DialogTitle>{ticket ? m.passOnTitle(ticket.number) : ''}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {staff
            .filter((s) => s.id !== ticket?.claimedBy?.id)
            .map((s) => (
              <Button key={s.id} variant="outline" className="h-12" onClick={() => ticket && onPick(ticket, s)}>
                {s.name}
              </Button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TicketCard({ ticket, busy, onMove, onPassOn }: { ticket: Ticket; busy: boolean; onMove: (status: TicketStatus) => void; onPassOn: () => void }) {
  const m = useMessages(STATION_MESSAGES)
  const next = nextStatus(ticket.status)
  const previous = previousStatus(ticket.status)
  const minutes = Math.floor((Date.now() - Date.parse(ticket.createdAt)) / 60_000)
  return (
    <article className={`flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ${ticket.paid || ticket.payLater ? 'ring-foreground/10' : 'ring-amber-500/60'}`} data-testid="ticket" data-number={ticket.number}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">#{ticket.number}</span>
          {ticket.mode && (
            <span className="truncate rounded-md bg-foreground px-2 py-0.5 text-sm font-bold text-background" data-testid="ticket-mode">
              {ticket.mode}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{m.ago(minutes)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {!ticket.paid && ticket.payLater && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-700 dark:text-violet-300">{m.onTab}</span>}
        {!ticket.paid && !ticket.payLater && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">{m.unpaid}</span>}
        {ticket.selfOrder && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">{m.selfOrder}</span>}
        {ticket.label && <span className="rounded bg-muted px-1.5 py-0.5">{ticket.label}</span>}
        {ticket.claimedBy && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-300" data-testid="ticket-claimed">
            {m.makes(ticket.claimedBy.name)}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1 text-base">
        {ticket.lines.map((l, i) => {
          const left = l.quantity - l.voided
          return (
            <li key={i} className={left <= 0 ? 'text-muted-foreground line-through' : ''}>
              <span className="font-semibold tabular-nums">{Math.max(left, 0) || l.quantity}×</span> {l.name}
              {l.voided > 0 && left > 0 && <span className="ml-1 text-xs text-muted-foreground">({m.voided(l.voided)})</span>}
              {l.note && <span className="block text-sm text-muted-foreground italic">{l.note}</span>}
            </li>
          )
        })}
      </ul>
      <div className="mt-1 flex gap-2">
        {previous && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onMove(previous)}>
            {m.back}
          </Button>
        )}
        {next && (
          <Button className="flex-1" size="lg" disabled={busy} onClick={() => onMove(next)}>
            {m.next[ticket.status]}
          </Button>
        )}
        {ticket.status === 'in_progress' && (
          <Button variant="outline" size="sm" disabled={busy} onClick={onPassOn} data-testid="pass-on-button">
            {m.passOn}
          </Button>
        )}
      </div>
    </article>
  )
}
