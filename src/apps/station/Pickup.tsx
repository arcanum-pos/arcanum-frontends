import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '@/shared/api-errors'
import { useMessages } from '@/shared/i18n'
import { connectNotifications } from '@/shared/terminal'
import { STATION_MESSAGES } from './messages'
import { pickupColumns, type PickupOrder } from './lib'

// The pickup screen (ROADMAP.md §5): a station's orders as guests see them
// — only their numbers, in three columns: received, being prepared, ready.
// Read-only and customer-facing (no platform branding, like the customer
// display). A device paired as one (station screen with view 'pickup'), or
// the station screen's own second window (station.html?view=pickup).
// Live: "tab X changed" → fetch again; a number that just became ready is
// highlighted for a few seconds. Ready ones drop off after a while by the
// clock alone (lib.ts pickupColumns) — no polling.

const HIGHLIGHT_MS = 8_000

export function Pickup({ device }: { device: { orgId: string; terminalId: string; stationId: string; stationName: string } }) {
  const m = useMessages(STATION_MESSAGES)
  const [orders, setOrders] = useState<PickupOrder[]>([])
  const [station, setStation] = useState(device.stationName)
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(Date.now())
  // Numbers seen under "Klaar", and since when — the new ones light up.
  const readySince = useRef(new Map<number, number>())
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(device.orgId)}/stations/${encodeURIComponent(device.stationId)}/pickup`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
      const list = (data.orders ?? []) as PickupOrder[]
      const seen = readySince.current
      const ready = new Set(list.filter((o) => o.status === 'ready').map((o) => o.number))
      // On the first load nothing is "new": the screen just opened.
      for (const n of ready) if (!seen.has(n)) seen.set(n, first.current ? 0 : Date.now())
      for (const n of [...seen.keys()]) if (!ready.has(n)) seen.delete(n)
      first.current = false
      setOrders(list)
      if (data.station) setStation(data.station)
      setOffline(false)
    } catch {
      // Keep showing what's there; say so quietly.
      setOffline(true)
    }
  }, [device])

  useEffect(() => {
    load()
    const reload = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(load, 200)
    }
    const socket = connectNotifications(device.terminalId, { tabs_changed: reload })
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    // The clock: highlights fade, old ready numbers drop off.
    const clock = setInterval(() => setNow(Date.now()), 5_000)
    return () => {
      socket.close()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(clock)
    }
  }, [device, load])

  const { received, preparing, ready } = pickupColumns(orders, now)
  const isNew = (n: number) => now - (readySince.current.get(n) ?? 0) < HIGHLIGHT_MS

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground" data-testid="pickup">
      <header className="flex items-baseline justify-between gap-4 px-8 pt-6 pb-4">
        <h1 className="text-4xl font-bold tracking-tight" data-testid="pickup-station">
          {station}
        </h1>
        {offline && <span className="size-3 rounded-full bg-amber-500" title="offline" aria-label="offline" />}
      </header>
      <main className="grid flex-1 gap-6 px-8 pb-8 md:grid-cols-[1fr_1fr_1.6fr]">
        <Column title={m.pickupColumns.received} testId="pickup-received" muted>
          {received.map((o) => (
            <OrderNumber key={o.number} order={o} size="md" muted />
          ))}
        </Column>
        <Column title={m.pickupColumns.preparing} testId="pickup-preparing">
          {preparing.map((o) => (
            <OrderNumber key={o.number} order={o} size="md" />
          ))}
        </Column>
        <Column title={m.pickupColumns.ready} testId="pickup-ready" ready hint={m.pickupReady}>
          {ready.map((o) => (
            <OrderNumber key={o.number} order={o} size="lg" ready highlight={isNew(o.number)} />
          ))}
        </Column>
      </main>
    </div>
  )
}

function Column({ title, testId, children, muted, ready, hint }: { title: string; testId: string; children: React.ReactNode[]; muted?: boolean; ready?: boolean; hint?: string }) {
  const m = useMessages(STATION_MESSAGES)
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-2xl p-5 ${ready ? 'bg-emerald-500/10 ring-2 ring-emerald-500/40' : 'bg-muted/50'}`} data-testid={testId}>
      <div>
        <h2 className={`text-2xl font-bold ${ready ? 'text-emerald-700 dark:text-emerald-300' : muted ? 'text-muted-foreground' : ''}`}>{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children.length === 0 ? <p className="text-lg text-muted-foreground">{m.pickupNothing}</p> : <div className="flex flex-wrap content-start gap-3">{children}</div>}
    </section>
  )
}

function OrderNumber({ order, size, muted, ready, highlight }: { order: PickupOrder; size: 'md' | 'lg'; muted?: boolean; ready?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl px-4 py-2 tabular-nums transition-colors ${
        ready ? `bg-emerald-600 text-white ${highlight ? 'animate-pulse ring-4 ring-emerald-300' : ''}` : 'bg-card ring-1 ring-foreground/10'
      }`}
      data-testid="pickup-number"
      data-number={order.number}
      data-new={highlight ? 'true' : undefined}
    >
      <span className={`font-bold ${size === 'lg' ? 'text-6xl' : 'text-4xl'} ${muted ? 'text-muted-foreground' : ''}`}>{order.number}</span>
      {order.mode && <span className={`text-sm font-semibold ${ready ? 'text-white/90' : 'text-muted-foreground'}`}>{order.mode}</span>}
    </div>
  )
}
