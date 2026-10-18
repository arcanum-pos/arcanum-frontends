import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CreditCard, Minus, Plus, QrCode, Smartphone, Wallet } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { listMyMemberships, type Membership } from '@/shared/memberships'
import { fetchKassaCatalog, type KassaCatalog, type KassaEntry } from '../kassa/catalog-api'
import * as tabsApi from '../kassa/tabs-api'
import { clearTable, connectLive, listEvents, listReaders, listTables, mergeTable, moveTable, promiseTable, seatTable, startPayment, sumupAppReturned, tableByQr, type EventInfo, type TableInfo } from './api'
import { EntranceScreen } from '@/shared/entrance-screen'
import { sumupAppLink, sumupAppReturn } from '@/shared/sumup-app'
import { WAITER_MESSAGES } from './messages'
import { showOrgIcons } from '@/shared/install'

// The waiter screen (DOMAIN_MODEL.md "Tables and waiters", release C): on a
// waiter's own phone, signed in (role Bediening, or admin / Kassa). The
// tables by zone, coloured by status — the table management too; a table:
// seat guests, order rounds from the event's "aan tafel" menu, take payment
// (Bancontact QR, a SumUp Solo; cash at the till), "Opgeruimd". A table's
// QR scanned with the camera lands here (/bediening?tafel=<token>). Live
// through the organisation's kassa channel.

const ORG_KEY = 'arcanum-waiter-org'
const EVENT_KEY = 'arcanum-waiter-event'
const SERVICE = new Set(['admin', 'cashier', 'waiter'])

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not remembered
  }
}

export default function App() {
  const m = useMessages(WAITER_MESSAGES)
  const [orgs, setOrgs] = useState<Membership[] | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [events, setEvents] = useState<EventInfo[] | null>(null)
  const [eventId, setEventId] = useState<string | null>(read(EVENT_KEY))
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signal, setSignal] = useState(0)
  // Back from the SumUp app (Tap to Pay): what the backend found at SumUp.
  const [tapNotice, setTapNotice] = useState<{ status: 'pending' | 'succeeded' | 'failed'; text: string | null } | null>(null)
  // This window as the entrance screen (opened from here: ?view=ingang).
  const [entrance] = useState(() => new URLSearchParams(window.location.search).get('view') === 'ingang')
  const subscribe = useCallback((onChange: () => void) => (orgId ? connectLive(orgId, onChange) : () => {}), [orgId])
  // A clock for "seated for x min", without fetching.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    listMyMemberships()
      .then((list) => {
        const mine = list.filter((x) => SERVICE.has(x.role))
        setOrgs(mine)
        const stored = read(ORG_KEY)
        setOrgId(mine.find((x) => x.orgId === stored)?.orgId ?? (mine.length === 1 ? mine[0].orgId : null))
      })
      .catch((err) => setError(err.message))
  }, [])

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setTables(await listTables(orgId))
      setSignal((n) => n + 1)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [orgId])

  // The organisation's own icon (the entrance screen's when it's that).
  useEffect(() => {
    if (orgId) showOrgIcons(orgId, entrance ? 'entrance' : 'waiter')
  }, [orgId, entrance])

  useEffect(() => {
    if (!orgId || entrance) return
    write(ORG_KEY, orgId)
    listEvents(orgId)
      .then((list) => {
        const usable = list.filter((e) => e.modes.some((x) => x.atTable && x.catalogId))
        setEvents(usable)
        setEventId((current) => (usable.some((e) => e.id === current) ? current : usable.length === 1 ? usable[0].id : null))
      })
      .catch(() => setEvents([]))
    load()
    // A table's QR scanned with the camera: that table.
    const qr = new URLSearchParams(window.location.search).get('tafel')
    if (qr) {
      tableByQr(orgId, qr)
        .then((t) => setOpenId(t.id))
        .catch((err) => setError(err.message))
        .finally(() => window.history.replaceState(null, '', '/bediening'))
    }
    // Back from the SumUp app: that table, and whether it's paid.
    const back = sumupAppReturn(window.location.search)
    if (back) {
      if (back.tableId) setOpenId(back.tableId)
      window.history.replaceState(null, '', '/bediening')
      sumupAppReturned(back.chargeId, back.status)
        .then((r) => {
          setTapNotice({ status: r.status, text: r.errorMessage })
          load()
        })
        .catch((err) => setTapNotice({ status: 'failed', text: err.message }))
    }
    const stop = connectLive(orgId, () => load())
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orgId, load, entrance])

  useEffect(() => {
    if (eventId) write(EVENT_KEY, eventId)
  }, [eventId])

  if (orgs === null) return <p className="p-6 text-muted-foreground">{m.loading}</p>
  if (orgs.length === 0) return <p className="p-6" data-testid="no-access">{m.noAccess}</p>
  if (!orgId)
    return (
      <Chooser title={m.chooseOrg}>
        {orgs.map((o) => (
          <Button key={o.orgId} variant="outline" className="h-14 justify-start text-base" onClick={() => setOrgId(o.orgId)}>
            {o.orgName}
          </Button>
        ))}
      </Chooser>
    )
  if (entrance) return <EntranceScreen orgId={orgId} subscribe={subscribe} />
  if (events && events.length === 0) return <p className="p-6" data-testid="no-event">{m.noEvent}</p>
  if (events && !eventId)
    return (
      <Chooser title={m.chooseEvent}>
        {events.map((e) => (
          <Button key={e.id} variant="outline" className="h-14 justify-start text-base" onClick={() => setEventId(e.id)}>
            {e.name}
          </Button>
        ))}
      </Chooser>
    )

  const event = events?.find((e) => e.id === eventId) ?? null
  const open = tables?.find((t) => t.id === openId) ?? null

  if (open && event)
    return (
      <TableScreen
        orgId={orgId}
        event={event}
        table={open}
        tables={tables ?? []}
        signal={signal}
        onBack={() => {
          setOpenId(null)
          setTapNotice(null)
        }}
        onChanged={load}
        onOpen={(id) => setOpenId(id)}
        notice={tapNotice}
      />
    )

  const zones = groupByZone(tables ?? [])
  return (
    <div className="flex min-h-svh flex-col bg-muted/40" data-testid="waiter">
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{m.tables}</h1>
          <button className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setEventId(null)}>
            {event?.name ?? ''}
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Legend />
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => window.open('/bediening?view=ingang', 'arcanum-entrance', 'popup,width=1280,height=800')?.focus()}
            data-testid="open-entrance"
          >
            {m.openEntrance}
          </button>
        </div>
      </header>
      {error && (
        <p className="bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <main className="flex flex-col gap-5 p-4">
        {tables?.length === 0 && <p className="text-sm text-muted-foreground">{m.noTables}</p>}
        {zones.map(([zone, list]) => (
          <section key={zone} className="flex flex-col gap-2">
            {zone && <h2 className="text-sm font-semibold text-muted-foreground uppercase">{zone}</h2>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className={cn('flex aspect-square flex-col items-center justify-center rounded-xl p-2 text-center ring-1', STATE_STYLE[t.state])}
                  data-testid="table"
                  data-state={t.state}
                >
                  <span className="text-2xl font-bold">{t.name}</span>
                  <span className="text-[11px] font-medium">{t.state === 'occupied' && t.tab ? formatEuro(t.tab.totalCents) : m.states[t.state]}</span>
                  {t.state === 'occupied' && t.tab && (
                    <span className="flex items-center gap-1 text-[10px] opacity-90">
                      {t.tab.preparing && <span className="size-2 rounded-full bg-amber-300" title={m.preparing} data-testid="preparing" />}
                      {m.minutes(Math.max(0, Math.floor((now - Date.parse(t.tab.openedAt)) / 60_000)))}
                    </span>
                  )}
                  {t.promised && (
                    <span className="mt-0.5 rounded bg-violet-600 px-1.5 text-[10px] font-semibold text-white" data-testid="promised-badge">
                      {m.promised}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

const STATE_STYLE: Record<TableInfo['state'], string> = {
  free: 'bg-card ring-foreground/10',
  occupied: 'bg-sky-600 text-white ring-sky-700',
  clearing: 'bg-amber-400 text-amber-950 ring-amber-500',
}

function Legend() {
  const m = useMessages(WAITER_MESSAGES)
  return (
    <div className="flex gap-2 text-[11px]">
      {(['free', 'occupied', 'clearing'] as const).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className={cn('size-3 rounded ring-1', STATE_STYLE[s])} />
          {m.states[s]}
        </span>
      ))}
    </div>
  )
}

function Chooser({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-3 p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
    </div>
  )
}

function groupByZone(tables: TableInfo[]): [string, TableInfo[]][] {
  const zones = new Map<string, TableInfo[]>()
  for (const t of tables) zones.set(t.zone ?? '', [...(zones.get(t.zone ?? '') ?? []), t])
  return [...zones]
}

// One table: seat guests, its tab, order a round, take payment, Opgeruimd.
function TableScreen({ orgId, event, table, tables, signal, onBack, onChanged, onOpen, notice }: { orgId: string; event: EventInfo; table: TableInfo; tables: TableInfo[]; signal: number; onBack: () => void; onChanged: () => void; onOpen: (id: string) => void; notice?: { status: 'pending' | 'succeeded' | 'failed'; text: string | null } | null }) {
  const m = useMessages(WAITER_MESSAGES)
  const [tab, setTab] = useState<tabsApi.TabDetail | null>(null)
  const [view, setView] = useState<'tab' | 'order' | 'pay' | 'move' | 'merge'>('tab')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode = event.modes.find((x) => x.atTable && x.catalogId) ?? null

  useEffect(() => {
    if (!table.tab) return setTab(null)
    tabsApi
      .getTab(orgId, table.tab.id)
      .then(setTab)
      .catch((err) => setError(err.message))
  }, [orgId, table.tab, signal])

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/40" data-testid="table-screen">
      <header className="flex items-center gap-2 border-b bg-card px-2 py-2">
        <Button variant="ghost" size="icon" onClick={view === 'tab' ? onBack : () => setView('tab')} aria-label={m.back}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{m.table(table.name)}</h1>
          <p className="text-xs text-muted-foreground">{m.states[table.state]}</p>
        </div>
      </header>
      {error && (
        <p className="bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && (
        // Back from the SumUp app (Tap to Pay).
        <p
          className={cn('px-4 py-2 text-sm font-medium', notice.status === 'succeeded' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' : notice.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/15 text-amber-800 dark:text-amber-200')}
          data-testid="tap-result"
          data-status={notice.status}
        >
          {notice.status === 'succeeded' ? m.tapPaid : notice.status === 'failed' ? m.tapFailed(notice.text) : m.tapChecking}
        </p>
      )}
      <main className="flex flex-1 flex-col gap-4 p-4">
        {table.state === 'free' && (
          <Button size="lg" className="h-14 text-base" disabled={busy} onClick={() => act(() => seatTable(orgId, table.id, event.id))} data-testid="seat">
            {m.seat}
          </Button>
        )}
        {table.state === 'clearing' && (
          <Button size="lg" className="h-14 text-base" disabled={busy} onClick={() => act(() => clearTable(orgId, table.id))} data-testid="cleared">
            {m.cleared}
          </Button>
        )}
        {table.state !== 'free' && view === 'tab' && (
          // Promised to guests waiting at the entrance (release D).
          <Button variant={table.promised ? 'secondary' : 'outline'} disabled={busy} onClick={() => act(() => promiseTable(orgId, table.id, !table.promised))} data-testid="promise">
            {table.promised ? m.unpromise : m.promise}
          </Button>
        )}
        {table.state === 'occupied' && tab && view === 'tab' && (
          <>
            <TabLines tab={tab} />
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" className="h-14" onClick={() => setView('order')} disabled={!mode} data-testid="order">
                <Plus /> {m.order}
              </Button>
              <Button size="lg" variant="outline" className="h-14" onClick={() => setView('pay')} disabled={tab.outstandingCents <= 0} data-testid="pay">
                <Wallet /> {m.pay}
              </Button>
              <Button variant="outline" onClick={() => setView('move')} data-testid="move">
                {m.move}
              </Button>
              <Button variant="outline" onClick={() => setView('merge')} data-testid="merge">
                {m.merge}
              </Button>
            </div>
          </>
        )}
        {table.state === 'occupied' && (view === 'move' || view === 'merge') && (
          <section className="flex flex-col gap-2" data-testid={`${view}-choice`}>
            <p className="text-sm text-muted-foreground">{view === 'move' ? m.moveTo : m.mergeInto}</p>
            <div className="grid grid-cols-3 gap-2">
              {tables
                .filter((x) => x.id !== table.id && !x.archived && (view === 'move' ? x.state === 'free' : x.state === 'occupied'))
                .map((x) => (
                  <Button
                    key={x.id}
                    variant="outline"
                    className="h-14 text-lg font-bold"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const target = view === 'move' ? await moveTable(orgId, table.id, x.id) : await mergeTable(orgId, table.id, x.id)
                        onOpen(target.id)
                        setView('tab')
                      })
                    }
                  >
                    {x.name}
                  </Button>
                ))}
            </div>
          </section>
        )}
        {table.state === 'occupied' && tab && view === 'order' && mode && (
          <OrderRound
            orgId={orgId}
            catalogId={mode.catalogId!}
            onSend={(lines) =>
              act(async () => {
                setTab(await tabsApi.addOrder(orgId, tab.id, lines, mode.catalogId))
                setView('tab')
              })
            }
            busy={busy}
          />
        )}
        {table.state === 'occupied' && tab && view === 'pay' && <PayAtTable orgId={orgId} tab={tab} table={table} />}
      </main>
    </div>
  )
}

function TabLines({ tab }: { tab: tabsApi.TabDetail }) {
  const m = useMessages(WAITER_MESSAGES)
  const lines = tab.lines.filter((l) => !l.voidsLineId && tabsApi.netQuantity(l) > 0)
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="tab-lines">
      {lines.length === 0 && <p className="text-sm text-muted-foreground">{m.nothingYet}</p>}
      <ul className="flex flex-col gap-1">
        {lines.map((l) => (
          <li key={l.id} className="flex justify-between text-sm">
            <span>
              {tabsApi.netQuantity(l)}× {l.name}
            </span>
            <span className="font-mono tabular-nums">{formatEuro(tabsApi.netQuantity(l) * l.unitPriceCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t pt-2 font-semibold">
        <span>{m.toPay}</span>
        <span className="font-mono tabular-nums" data-testid="outstanding">
          {formatEuro(tab.outstandingCents)}
        </span>
      </div>
    </section>
  )
}

// A round: the "aan tafel" menu, + and −, then send it to the stations.
function OrderRound({ orgId, catalogId, onSend, busy }: { orgId: string; catalogId: string; onSend: (lines: tabsApi.DraftLine[]) => void; busy: boolean }) {
  const m = useMessages(WAITER_MESSAGES)
  const [catalog, setCatalog] = useState<KassaCatalog | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    fetchKassaCatalog(orgId, catalogId).then(setCatalog)
  }, [orgId, catalogId])
  const entries = useMemo(() => new Map((catalog?.sections ?? []).flatMap((s) => s.entries).map((e) => [e.variantId, e])), [catalog])
  const lines: tabsApi.DraftLine[] = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([variantId, quantity]) => {
      const e = entries.get(variantId) as KassaEntry
      return { variantId, quantity, name: e.name, unitPriceCents: e.priceCents, itemCode: e.code }
    })
  const total = lines.reduce((n, l) => n + l.quantity * l.unitPriceCents, 0)
  const change = (id: string, d: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }))
  return (
    <div className="flex flex-col gap-4" data-testid="order-round">
      {(catalog?.sections ?? []).map((s) => (
        <section key={s.id} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">{s.name}</h2>
          {s.entries.map((e) => (
            <div key={e.entryId} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">{formatEuro(e.priceCents)}</span>
              </span>
              {(counts[e.variantId] ?? 0) > 0 && (
                <>
                  <Button size="icon" variant="outline" onClick={() => change(e.variantId, -1)} aria-label={m.less(e.name)}>
                    <Minus />
                  </Button>
                  <span className="w-6 text-center font-mono tabular-nums">{counts[e.variantId]}</span>
                </>
              )}
              <Button size="icon" onClick={() => change(e.variantId, 1)} aria-label={m.more(e.name)}>
                <Plus />
              </Button>
            </div>
          ))}
        </section>
      ))}
      <Button size="lg" className="sticky bottom-4 h-14 text-base" disabled={busy || lines.length === 0} onClick={() => onSend(lines)} data-testid="send-round">
        {m.send(formatEuro(total))}
      </Button>
    </div>
  )
}

// Paying at the table (T4): Bancontact's QR on this phone, a SumUp Solo,
// Tap to Pay on this phone through the SumUp app (release E), or the till for cash.
function PayAtTable({ orgId, tab, table }: { orgId: string; tab: tabsApi.TabDetail; table: TableInfo }) {
  const m = useMessages(WAITER_MESSAGES)
  const [qr, setQr] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [readers, setReaders] = useState<{ id: string; name: string }[]>([])
  const [tapToPay, setTapToPay] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    listReaders(orgId).then((r) => {
      setReaders(r.readers)
      setTapToPay(r.tapToPay)
    })
  }, [orgId])
  async function pay(method: 'bancontact' | 'sumup', readerId?: string, app = false) {
    setBusy(true)
    setError(null)
    try {
      const res = await startPayment(orgId, tab.id, tab.outstandingCents, method, readerId, app)
      if (app && res.sumupApp) {
        // To the SumUp app; it comes back to this table (see sumupAppReturn).
        const returnUrl = new URL('/bediening', window.location.href)
        returnUrl.searchParams.set('sumup-charge', res.chargeId)
        returnUrl.searchParams.set('table', table.id)
        window.location.href = sumupAppLink({ ...res.sumupApp, amountCents: tab.outstandingCents, title: m.table(table.name), chargeId: res.chargeId, returnUrl: returnUrl.toString() })
        return
      }
      if (method === 'bancontact') setQr(res.qrCodeUrl ?? null)
      else setSent(readers.find((r) => r.id === readerId)?.name ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  if (tab.status !== 'open' || tab.outstandingCents <= 0) return <p className="rounded-xl bg-emerald-500/15 p-4 text-center text-lg font-semibold text-emerald-800 dark:text-emerald-200" data-testid="paid">{m.paid}</p>
  return (
    <div className="flex flex-col gap-3" data-testid="pay-at-table">
      <p className="text-center text-3xl font-bold tabular-nums">{formatEuro(tab.outstandingCents)}</p>
      {qr ? (
        <div className="flex flex-col items-center gap-2">
          <img src={qr} alt="Bancontact" className="size-64 rounded-lg bg-white p-2" data-testid="bancontact-qr" />
          <p className="text-sm text-muted-foreground">{m.scanBancontact}</p>
        </div>
      ) : sent !== null ? (
        <p className="rounded-xl bg-card p-4 text-center" data-testid="sumup-sent">{m.onReader(sent)}</p>
      ) : (
        <>
          <Button size="lg" className="h-14" disabled={busy} onClick={() => pay('bancontact')}>
            <QrCode /> {m.bancontact}
          </Button>
          {tapToPay && (
            <Button size="lg" variant="outline" className="h-14" disabled={busy} onClick={() => pay('sumup', undefined, true)} data-testid="tap-to-pay">
              <Smartphone /> {m.tapToPay}
            </Button>
          )}
          {readers.map((r) => (
            <Button key={r.id} size="lg" variant="outline" className="h-14" disabled={busy} onClick={() => pay('sumup', r.id)}>
              <CreditCard /> {m.sumup(r.name)}
            </Button>
          ))}
          <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground" data-testid="cash-at-till">
            {m.cashAtTill(tab.label)}
          </p>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
