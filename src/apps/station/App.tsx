import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/shared/api-errors'
import { useMessages } from '@/shared/i18n'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { STATION_MESSAGES } from './messages'
import { nextStatus, previousStatus, visibleTickets, type Ticket, type TicketStatus } from './lib'

// A station screen (device role 'station'): the prep tickets (bonnen) of the
// one station this device is linked to, in columns by status — DOMAIN_MODEL.md
// "Self-ordering and station screens". Tap a ticket's button to move it on:
// ordered → in progress → ready → delivered. Only paid orders by default
// (the toggle shows unpaid ones too); delivered ones only when asked.
// Live: the notification socket says "tab X changed", then this screen
// fetches its tickets again — never polling.

const FILTERS_KEY = 'arcanum-station-filters'

function storedFilters(): { onlyPaid: boolean; showDelivered: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(FILTERS_KEY) || 'null')
    return { onlyPaid: value?.onlyPaid !== false, showDelivered: value?.showDelivered === true }
  } catch {
    return { onlyPaid: true, showDelivered: false }
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data as T
}

const COLUMNS: TicketStatus[] = ['ordered', 'in_progress', 'ready', 'delivered']

export default function App() {
  const m = useMessages(STATION_MESSAGES)
  const [device, setDevice] = useState<{ orgId: string; terminalId: string; stationId: string | null; stationName: string; orgName: string } | null>(null)
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(storedFilters)
  const [busy, setBusy] = useState<string | null>(null)
  // Re-renders the "x min ago" once a minute — a local clock, no server calls.
  const [, setNow] = useState(Date.now())
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped by every tap: a list that was already on its way from before the
  // tap is stale — it must not put the ticket back where it was.
  const generation = useRef(0)

  const load = useCallback(async () => {
    if (!device?.stationId) return
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

  // A burst of changes (several tickets at once): one reload.
  const scheduleLoad = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current)
    loadTimer.current = setTimeout(load, 200)
  }, [load])

  useEffect(() => {
    getRegisteredTerminal('station').then(async (terminal) => {
      if (!terminal) {
        window.location.replace('/')
        return
      }
      const info = await call<{ station_id?: string; station_name?: string | null }>(
        `/api/organizations/${encodeURIComponent(terminal.orgId)}/devices/${encodeURIComponent(terminal.terminalId)}`
      ).catch(() => ({}) as { station_id?: string; station_name?: string | null })
      setDevice({ orgId: terminal.orgId, terminalId: terminal.terminalId, stationId: info.station_id ?? null, stationName: info.station_name ?? terminal.name ?? '', orgName: terminal.orgName ?? '' })
    })
    const clock = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    if (!device) return
    load()
    const socket = connectNotifications(device.terminalId, { tabs_changed: () => scheduleLoad() })
    // A push missed while the socket was down: reload when looked at again.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      socket.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [device, load, scheduleLoad])

  function setFilter(key: 'onlyPaid' | 'showDelivered', value: boolean) {
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
      await call(`/api/organizations/${encodeURIComponent(device.orgId)}/tickets/${encodeURIComponent(ticket.id)}`, { method: 'POST', body: JSON.stringify({ status }) })
      setTickets((list) => list?.map((t) => (t.id === ticket.id ? { ...t, status } : t)) ?? list)
      scheduleLoad()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (!device) return <p className="p-6 text-muted-foreground">{m.loading}</p>
  if (!device.stationId) return <p className="p-6" data-testid="no-station">{m.noStation}</p>

  const { shown, hiddenUnpaid } = visibleTickets(tickets ?? [], filters)
  const columns = COLUMNS.filter((c) => c !== 'delivered' || filters.showDelivered)

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight" data-testid="station-name">{device.stationName}</h1>
          <p className="truncate text-xs text-muted-foreground">{device.orgName}</p>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={filters.onlyPaid} onCheckedChange={(v) => setFilter('onlyPaid', v)} aria-label={m.onlyPaid} />
          {m.onlyPaid}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={filters.showDelivered} onCheckedChange={(v) => setFilter('showDelivered', v)} aria-label={m.showDelivered} />
          {m.showDelivered}
        </label>
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
                <TicketCard key={t.id} ticket={t} busy={busy === t.id} onMove={(s) => move(t, s)} />
              ))}
            </section>
          )
        })}
      </main>
    </div>
  )
}

function TicketCard({ ticket, busy, onMove }: { ticket: Ticket; busy: boolean; onMove: (status: TicketStatus) => void }) {
  const m = useMessages(STATION_MESSAGES)
  const next = nextStatus(ticket.status)
  const previous = previousStatus(ticket.status)
  const minutes = Math.floor((Date.now() - Date.parse(ticket.createdAt)) / 60_000)
  return (
    <article className={`flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ${ticket.paid ? 'ring-foreground/10' : 'ring-amber-500/60'}`} data-testid="ticket" data-number={ticket.number}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums">#{ticket.number}</span>
        <span className="text-xs text-muted-foreground">{m.ago(minutes)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {!ticket.paid && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">{m.unpaid}</span>}
        {ticket.selfOrder && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">{m.selfOrder}</span>}
        {ticket.label && <span className="rounded bg-muted px-1.5 py-0.5">{ticket.label}</span>}
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
      </div>
    </article>
  )
}
