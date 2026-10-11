import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/shared/api-errors'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { LanguagePicker } from '@/shared/i18n/language-picker'
import { SELF_ORDER_MESSAGES } from './messages'
import { cartLines, cartTotals, changeQuantity, isFinal, loadSaved, newlyReady, readyPlaces, route, save, type Cart, type FollowStatus, type Menu } from './lib'

// A guest's own phone — DOMAIN_MODEL.md "Self-ordering and station screens".
//   /bestel/<event code>: 1 menu → 2 cart → 3 pay ("Betaal aan de toog") → 4 your order
//   /volg/<order token>:  4 only (a kassa customer scanned the customer display's QR)
// Step 4 follows the order live: the order hub says "changed", the page then
// fetches its status — and fetches it once more after a reconnect (a phone
// waking up). Never polling. Ready: a big message, a vibration and a beep.
// Phone first: one column, large tap targets, a fixed bar at the bottom.

const PAY_MINUTES = 10

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { status: res.status })
  return data as T
}

export default function App() {
  const where = route(window.location.pathname)
  const m = useMessages(SELF_ORDER_MESSAGES)
  if (!where) return <Shell><p className="py-10 text-center text-muted-foreground">{m.notFound}</p></Shell>
  if (where.kind === 'follow') return <Shell><Follow token={where.token} /></Shell>
  return <SelfOrder code={where.code} />
}

function Shell({ title, children, step }: { title?: string; children: React.ReactNode; step?: number }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" data-testid="event-name">{title}</h1>
        <LanguagePicker persist className="shrink-0" />
      </header>
      {step !== undefined && <Steps step={step} />}
      <main className="flex flex-1 flex-col px-4 pt-4 pb-6">{children}</main>
    </div>
  )
}

function Steps({ step }: { step: number }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const labels = [m.steps.menu, m.steps.cart, m.steps.pay, m.steps.done]
  return (
    <ol className="grid grid-cols-4 gap-1 px-4 pt-3" aria-label={labels[step]}>
      {labels.map((label, i) => (
        <li key={label} className="flex flex-col gap-1" aria-current={i === step ? 'step' : undefined}>
          <span className={`h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          <span className={`truncate text-[11px] ${i === step ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function SelfOrder({ code }: { code: string }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart>(() => loadSaved(code).cart)
  const [token, setToken] = useState<string | null>(() => loadSaved(code).token)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(() => (loadSaved(code).token ? 3 : 0))
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    call<Menu>(`/api/public/self-order/${encodeURIComponent(code)}`)
      .then(setMenu)
      .catch((err) => setError(err.status === 404 ? m.closed : err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    save(code, { cart, token })
  }, [code, cart, token])
  // Each step starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const lines = cartLines(cart, menu)
  const totals = cartTotals(lines)

  async function place() {
    setPlacing(true)
    setError(null)
    unlockSound()
    try {
      const placed = await call<{ token: string; number: number }>(`/api/public/self-order/${encodeURIComponent(code)}/orders`, {
        method: 'POST',
        body: JSON.stringify({ lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
      })
      setCart({})
      setToken(placed.token)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlacing(false)
    }
  }

  const startOver = useCallback(() => {
    setToken(null)
    setStep(0)
  }, [])

  if (step === 3 && token) {
    return (
      <Shell title={menu?.eventName} step={3}>
        <Follow token={token} onStartOver={startOver} />
      </Shell>
    )
  }
  if (!menu) {
    return (
      <Shell>
        <p className="py-10 text-center text-muted-foreground" role={error ? 'alert' : undefined}>{error ?? m.loading}</p>
      </Shell>
    )
  }
  if (!menu.open || !menu.catalog) {
    return (
      <Shell title={menu.eventName}>
        <p className="py-10 text-center text-muted-foreground" data-testid="closed">{m.closed}</p>
      </Shell>
    )
  }

  if (step === 0) {
    return (
      <Shell title={menu.eventName} step={0}>
        <div className="flex flex-col gap-6 pb-24">
          {menu.catalog.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{section.name}</h2>
              <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10">
                {section.entries.map((e) => (
                  <li key={e.variantId} className="flex items-center gap-3 px-3 py-2.5" data-testid="menu-entry">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{e.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">{formatEuro(e.priceCents)}</p>
                    </div>
                    <Stepper name={e.name} quantity={cart[e.variantId] || 0} onChange={(d) => setCart((c) => changeQuantity(c, e.variantId, d))} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {totals.count > 0 && (
          <BottomBar>
            <Button size="lg" className="h-14 w-full justify-between text-base" onClick={() => setStep(1)} data-testid="to-cart">
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5" aria-hidden="true" />
                {m.toCart} · {m.cartBar(totals.count)}
              </span>
              <span className="tabular-nums">{formatEuro(totals.cents)}</span>
            </Button>
          </BottomBar>
        )}
      </Shell>
    )
  }

  if (step === 1) {
    return (
      <Shell title={menu.eventName} step={1}>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{m.emptyCart}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10" data-testid="cart">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{l.name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">{formatEuro(l.priceCents * l.quantity)}</p>
                </div>
                <Stepper name={l.name} quantity={l.quantity} onChange={(d) => setCart((c) => changeQuantity(c, l.variantId, d))} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-baseline justify-between text-lg font-semibold">
          <span>{m.total}</span>
          <span className="tabular-nums" data-testid="cart-total">{formatEuro(totals.cents)}</span>
        </div>
        <div className="mt-6 flex flex-col gap-2 pb-24">
          <Button variant="outline" size="lg" className="h-12" onClick={() => setStep(0)}>
            {m.backToMenu}
          </Button>
        </div>
        {lines.length > 0 && (
          <BottomBar>
            <Button size="lg" className="h-14 w-full text-base" onClick={() => setStep(2)}>
              {m.next}
            </Button>
          </BottomBar>
        )}
      </Shell>
    )
  }

  // step 2: pay — for now always at the toog.
  return (
    <Shell title={menu.eventName} step={2}>
      <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-xl font-bold">{m.payTitle}</h2>
        <p className="text-sm">{m.payHint}</p>
        <p className="text-sm text-muted-foreground">{m.payWithin(PAY_MINUTES)}</p>
        <div className="flex items-baseline justify-between border-t pt-3 text-lg font-semibold">
          <span>{m.total}</span>
          <span className="tabular-nums">{formatEuro(totals.cents)}</span>
        </div>
      </section>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="mt-6 flex flex-col gap-2 pb-24">
        <Button variant="outline" size="lg" className="h-12" onClick={() => setStep(1)} disabled={placing}>
          {m.steps.cart}
        </Button>
      </div>
      <BottomBar>
        <Button size="lg" className="h-14 w-full text-base" onClick={place} disabled={placing || lines.length === 0}>
          {placing ? m.placing : m.place}
        </Button>
      </BottomBar>
    </Shell>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
      {children}
    </div>
  )
}

function Stepper({ name, quantity, onChange }: { name: string; quantity: number; onChange: (delta: number) => void }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  return (
    <div className="flex shrink-0 items-center gap-1">
      {quantity > 0 && (
        <>
          <Button variant="outline" size="icon" className="size-11 rounded-full" onClick={() => onChange(-1)} aria-label={m.remove(name)}>
            <Minus />
          </Button>
          <span className="w-7 text-center text-lg font-semibold tabular-nums" data-testid="quantity">{quantity}</span>
        </>
      )}
      <Button size="icon" className="size-11 rounded-full" onClick={() => onChange(1)} aria-label={m.add(name)}>
        <Plus />
      </Button>
    </div>
  )
}

// --- Step 4: your order, live ---

function Follow({ token, onStartOver }: { token: string; onStartOver?: () => void }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const { status, error, live } = useFollow(token)

  // Everything collected: a self-order phone goes back to the menu.
  useEffect(() => {
    if (status?.state !== 'delivered' && status?.state !== 'cancelled') return
    if (!onStartOver || status.state === 'cancelled') return
    const t = setTimeout(onStartOver, 6000)
    return () => clearTimeout(t)
  }, [status?.state, onStartOver])

  if (!status) return <p className="py-10 text-center text-muted-foreground" role={error ? 'alert' : undefined}>{error ?? m.loading}</p>

  const places = readyPlaces(status)
  const ready = status.state === 'ready' || places.length > 0
  return (
    <div className="flex flex-col gap-4" data-testid="follow" data-state={status.state}>
      <section className={`flex flex-col items-center gap-1 rounded-2xl p-6 text-center ring-1 ${ready ? 'bg-emerald-500/15 ring-emerald-500/50' : 'bg-card ring-foreground/10'}`}>
        <p className="text-sm text-muted-foreground">{m.yourNumber}</p>
        <p className="text-7xl font-black tabular-nums" data-testid="order-number">{status.number}</p>
        {ready && <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300" role="status">{m.ready}</p>}
        <p className="mt-2 text-base font-medium" data-testid="follow-message">{message(m, status, places)}</p>
      </section>

      {status.stations.length > 0 && status.state !== 'awaiting_payment' && status.state !== 'cancelled' && (
        <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10" data-testid="stations">
          {status.stations.map((s) => (
            <li key={s.name} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{s.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${s.status === 'ready' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-muted'}`}>
                {m.stationStatus[s.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isFinal(status.state) && (
        <p className="text-center text-sm text-muted-foreground">
          {m.keepOpen} <span className={live ? 'text-emerald-600' : ''}>{live ? `● ${m.live}` : ''}</span>
        </p>
      )}
      {error && <p className="text-center text-sm text-muted-foreground">{m.offline}</p>}

      <details className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <summary className="cursor-pointer font-medium">
          {m.yourOrder} · <span className="tabular-nums">{formatEuro(status.totalCents)}</span>
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {status.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">
                {l.quantity}× {l.name}
              </span>
              <span className="tabular-nums">{formatEuro(l.quantity * l.unitPriceCents)}</span>
            </li>
          ))}
        </ul>
      </details>

      {(status.state === 'cancelled' || status.state === 'delivered' || status.state === 'nothing_to_prepare') && (onStartOver || status.selfOrderCode) && (
        onStartOver ? (
          <Button size="lg" className="h-12" onClick={onStartOver}>
            {m.newOrder}
          </Button>
        ) : (
          <Button size="lg" className="h-12" asChild>
            <a href={`/bestel/${status.selfOrderCode}`}>{m.newOrder}</a>
          </Button>
        )
      )}
    </div>
  )
}

function message(m: ReturnType<typeof useMessages<typeof SELF_ORDER_MESSAGES.nl>>, status: FollowStatus, places: string[]): string {
  switch (status.state) {
    case 'awaiting_payment':
      return m.goPay(status.number)
    case 'cancelled':
      return m.cancelled
    case 'nothing_to_prepare':
      return m.nothingToPrepare
    case 'delivered':
      return m.delivered
    default:
      return places.length ? m.readyHint(places.join(', ')) : m.preparing
  }
}

// The order's status, live: fetched once, then again whenever the order hub
// says it changed — and after a reconnect (the socket dropped, the phone
// woke up), since a change may have been missed meanwhile. A final state
// (delivered, cancelled, nothing to prepare) needs no socket any more.
function useFollow(token: string) {
  const [status, setStatus] = useState<FollowStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const previous = useRef<FollowStatus | null>(null)

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let retryMs = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function refresh() {
      try {
        const next = await call<FollowStatus>(`/api/public/orders/${encodeURIComponent(token)}`)
        if (stopped) return
        if (newlyReady(previous.current, next) && previous.current) signalReady()
        previous.current = next
        setStatus(next)
        setError(null)
        if (isFinal(next.state)) socket?.close()
        else if (!socket && next.hubTicket) connect(next.hubTicket)
      } catch (err) {
        if (stopped) return
        setError(err instanceof Error ? err.message : String(err))
        if ((err as { status?: number }).status !== 404) reconnectLater()
      }
    }

    function connect(ticket: string) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/orders/connect?ticket=${encodeURIComponent(ticket)}`)
      socket = ws
      ws.onopen = () => {
        retryMs = 1000
        setLive(true)
      }
      ws.onmessage = (event) => {
        try {
          if (JSON.parse(event.data).event === 'order_updated') refresh()
        } catch {
          // not ours
        }
      }
      ws.onclose = () => {
        if (socket === ws) socket = null
        setLive(false)
        if (!stopped && !(previous.current && isFinal(previous.current.state))) reconnectLater()
      }
      ws.onerror = () => ws.close()
    }

    // Back after a dropped socket or a failed fetch: the status first (a
    // change may have been missed, and it brings a fresh ticket).
    function reconnectLater() {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(refresh, retryMs)
      retryMs = Math.min(retryMs * 2, 30_000)
    }

    function onVisible() {
      if (document.visibilityState === 'visible' && !socket) refresh()
    }

    refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      socket?.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token])

  return { status, error, live }
}

// --- The "ready" signal: a vibration and a short beep ---
// Browsers only play sound after a tap on the page: the first tap (placing
// the order counts) unlocks it.
let audio: AudioContext | null = null

function unlockSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

if (typeof window !== 'undefined') window.addEventListener('pointerdown', unlockSound, { once: true })

function signalReady() {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400])
  } catch {
    // no vibration
  }
  if (!audio || audio.state !== 'running') return
  for (const [at, freq] of [
    [0, 880],
    [0.22, 1175],
  ] as const) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, audio.currentTime + at)
    gain.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.2)
    osc.connect(gain).connect(audio.destination)
    osc.start(audio.currentTime + at)
    osc.stop(audio.currentTime + at + 0.22)
  }
}
