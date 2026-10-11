import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Minus, Plus, Share2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/shared/api-errors'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { LanguagePicker } from '@/shared/i18n/language-picker'
import { SELF_ORDER_MESSAGES } from './messages'
import {
  bancontactTarget,
  cartLines,
  cartTotals,
  changeQuantity,
  isDone,
  loadSaved,
  modeFromSearch,
  newlyReady,
  pickMode,
  readyPlaces,
  route,
  save,
  type BancontactLinks,
  type Cart,
  type FollowStatus,
  type Menu,
} from './lib'

// A guest's own phone — DOMAIN_MODEL.md "Self-ordering and station screens".
//   /bestel/<event code>: (how you order, with more than one ordering mode) → 1 menu
//                         → 2 cart → 3 pay ("Betaal aan de toog") → 4 your order
//   /bestel/<code>?m=<mode>: straight to that mode's menu (a poster at the take-away window)
//   /volg/<order token>:  4 only (a kassa customer scanned the customer display's QR)
// Once an order is placed, the address becomes its follow page (/volg/<token>,
// replacing the entry — no extra Back step): Back and Forward, a reload, a
// tab restored, or coming back from Bancontact all land on it. This phone
// also remembers the order per event (localStorage), so the event's link
// brings it back too. Only where the browser keeps nothing at all does step
// 4 offer to keep its link (share or copy).
// Step 4 follows the order live: the order hub says "changed", the page then
// fetches its status — and fetches it once more after a reconnect (a phone
// waking up). Never polling. Ready: a big message, a vibration and a beep.
// Phone first: one column, large tap targets, a fixed bar at the bottom.

const PAY_MINUTES = 10

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia?.('(pointer: coarse)').matches

// Pays a self-order with Bancontact: the payment (or the one already in
// progress), then off to the Bancontact app (a computer: its checkout page).
// The app sends the guest back to /volg/<token> — in whichever browser it opens.
async function payWithBancontact(token: string) {
  const links = await call<BancontactLinks>(`/api/public/orders/${encodeURIComponent(token)}/bancontact`, { method: 'POST' })
  const target = bancontactTarget(links, isPhone())
  if (target) window.location.assign(target)
}

// The address shown, without a new history entry.
function showUrl(path: string) {
  if (window.location.pathname + window.location.search !== path) window.history.replaceState(window.history.state, '', path)
}

// Whether this browser keeps anything for the page (localStorage): not when
// storage is blocked. A private window keeps it until it's closed — that
// can't be told apart, and isn't meant to be.
function storageWorks(): boolean {
  try {
    localStorage.setItem('arcanum-selforder:probe', '1')
    localStorage.removeItem('arcanum-selforder:probe')
    return true
  } catch {
    return false
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { status: res.status })
  return data as T
}

export default function App() {
  // Where the page was opened — not re-read when the address changes under it (followUrl).
  const [where] = useState(() => route(window.location.pathname))
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
  // The ordering mode: from a direct link (?m=), else what this phone chose for its current order.
  const [directMode] = useState(() => modeFromSearch(window.location.search))
  const [modeId, setModeId] = useState<string | null>(() => directMode ?? loadSaved(code).modeId)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(() => (loadSaved(code).token ? 3 : 0))
  const [placing, setPlacing] = useState(false)
  // Adding a round to the open tab (token) rather than a new order.
  const [round, setRound] = useState(false)

  useEffect(() => {
    call<Menu>(`/api/public/self-order/${encodeURIComponent(code)}`)
      .then(setMenu)
      .catch((err) => setError(err.status === 404 ? m.closed : err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    save(code, { cart, token, modeId })
  }, [code, cart, token, modeId])
  // Each step starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])
  // The address: the order's follow page once there is one, else the event's.
  useEffect(() => {
    showUrl(step === 3 && token ? `/volg/${token}` : `/bestel/${code}${directMode ? `?m=${encodeURIComponent(directMode)}` : ''}`)
  }, [step, token, code, directMode])

  const mode = pickMode(menu, modeId)
  const lines = cartLines(cart, mode?.catalog)
  const totals = cartTotals(lines)

  // Places the order — then, for Bancontact, straight on to paying it (the
  // order is remembered first, so coming back lands on step 4).
  async function place(pay: 'counter' | 'bancontact' | 'tab') {
    setPlacing(true)
    setError(null)
    unlockSound()
    let placedToken: string | null = null
    try {
      const placed = await call<{ token: string; number: number }>(`/api/public/self-order/${encodeURIComponent(code)}/orders`, {
        method: 'POST',
        body: JSON.stringify({ modeId: mode?.id, lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
      })
      placedToken = placed.token
      setCart({})
      setToken(placed.token)
      save(code, { cart: {}, token: placed.token, modeId })
      // Off to Bancontact from the follow page's address: Back from there lands on it.
      showUrl(`/volg/${placed.token}`)
      if (pay === 'bancontact') await payWithBancontact(placed.token)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      // Placed, but the payment couldn't start: step 4 offers it again.
      if (placedToken) setStep(3)
    } finally {
      setPlacing(false)
    }
  }

  // One more round on the open tab.
  async function addRound() {
    if (!token) return
    setPlacing(true)
    setError(null)
    unlockSound()
    try {
      await call(`/api/public/orders/${encodeURIComponent(token)}/orders`, {
        method: 'POST',
        body: JSON.stringify({ lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
      })
      setCart({})
      setRound(false)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlacing(false)
    }
  }

  // A new order: the way of ordering is chosen again (unless the link says which).
  const startOver = useCallback(() => {
    setModeId(directMode)
    setToken(null)
    setRound(false)
    setStep(0)
  }, [directMode])

  // Another round: from the tab's own ordering mode's menu.
  const orderMore = useCallback((tabModeId: string | null) => {
    if (tabModeId) setModeId(tabModeId)
    setRound(true)
    setStep(0)
  }, [])

  if (step === 3 && token) {
    return (
      <Shell title={menu?.eventName} step={3}>
        <Follow token={token} onStartOver={startOver} onOrderMore={orderMore} />
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
  if (!menu.open || menu.modes.length === 0) {
    return (
      <Shell title={menu.eventName}>
        <p className="py-10 text-center text-muted-foreground" data-testid="closed">{m.closed}</p>
      </Shell>
    )
  }

  // Another round, but the tab's mode can't be ordered with any more.
  if (!mode && round && token) {
    return (
      <Shell title={menu.eventName}>
        <p className="py-10 text-center text-muted-foreground" data-testid="closed">{m.modeGone}</p>
        <Button variant="outline" size="lg" className="h-12" onClick={() => setStep(3)}>
          ← {m.steps.done}
        </Button>
      </Shell>
    )
  }

  // More than one ordering mode: first how ("Ter plaatse", "Take away").
  if (!mode) {
    return (
      <Shell title={menu.eventName} step={0}>
        <section className="flex flex-col gap-3 pt-2" data-testid="choose-mode">
          <h2 className="text-xl font-bold">{m.chooseMode}</h2>
          {menu.modes.map((choice) => (
            <Button key={choice.id} size="lg" variant="outline" className="h-16 justify-start text-lg font-semibold" onClick={() => setModeId(choice.id)}>
              {choice.name}
            </Button>
          ))}
        </section>
      </Shell>
    )
  }

  if (step === 0) {
    return (
      <Shell title={menu.eventName} step={0}>
        {round && token && (
          <Button variant="ghost" className="mb-2 self-start" onClick={() => setStep(3)}>
            ← {m.steps.done}
          </Button>
        )}
        {menu.modes.length > 1 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2" data-testid="chosen-mode">
            <span className="min-w-0 truncate font-semibold">{mode.name}</span>
            {!round && (
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setModeId(null)}>
                {m.changeMode}
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-6 pb-24">
          {mode.catalog.sections.map((section) => (
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

  // step 2, another round on the tab: just add it.
  if (round && token) {
    return (
      <Shell title={menu.eventName} step={2}>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="add-round">
          <h2 className="text-xl font-bold">{m.addRoundTitle}</h2>
          <div className="flex items-baseline justify-between text-lg font-semibold">
            <span>{m.total}</span>
            <span className="tabular-nums">{formatEuro(totals.cents)}</span>
          </div>
          <Button size="lg" className="h-14 text-base" onClick={addRound} disabled={placing || lines.length === 0}>
            {placing ? m.placing : m.addRound}
          </Button>
        </section>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button variant="ghost" size="lg" className="mt-3 h-12" onClick={() => setStep(1)} disabled={placing}>
          {m.steps.cart}
        </Button>
      </Shell>
    )
  }

  // step 2, a mode with tabs: the order goes on the tab, paid when leaving.
  if (mode.payment.tab) {
    return (
      <Shell title={menu.eventName} step={2}>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="tab-order">
          <h2 className="text-xl font-bold">{m.tabOrder}</h2>
          <p className="text-sm">{m.tabOrderHint}</p>
          <div className="flex items-baseline justify-between border-t pt-3 text-lg font-semibold">
            <span>{m.total}</span>
            <span className="tabular-nums">{formatEuro(totals.cents)}</span>
          </div>
          <Button size="lg" className="h-14 text-base" onClick={() => place('tab')} disabled={placing || lines.length === 0}>
            {placing ? m.placing : m.tabOrder}
          </Button>
        </section>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button variant="ghost" size="lg" className="mt-3 h-12" onClick={() => setStep(1)} disabled={placing}>
          {m.steps.cart}
        </Button>
      </Shell>
    )
  }

  // step 2: pay — the ways this mode allows: Bancontact on the phone, and/or at the toog.
  const payment = mode.payment
  return (
    <Shell title={menu.eventName} step={2}>
      <div className="flex flex-col gap-3 pb-6">
        <div className="flex items-baseline justify-between text-lg font-semibold">
          <span>{m.total}</span>
          <span className="tabular-nums">{formatEuro(totals.cents)}</span>
        </div>
        {payment.bancontact && payment.counter && <h2 className="text-base font-semibold">{m.payOptions}</h2>}
        {payment.bancontact && (
          <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="pay-bancontact">
            <h2 className="text-xl font-bold">{m.payBancontact}</h2>
            <p className="text-sm">{m.payBancontactHint}</p>
            <Button size="lg" className="h-14 text-base" onClick={() => place('bancontact')} disabled={placing || lines.length === 0}>
              {placing ? m.placing : m.payBancontact}
            </Button>
          </section>
        )}
        {payment.counter && (
          <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="pay-counter">
            <h2 className="text-xl font-bold">{m.payTitle}</h2>
            <p className="text-sm">{m.payHint}</p>
            <p className="text-sm text-muted-foreground">{m.payWithin(PAY_MINUTES)}</p>
            <Button size="lg" variant={payment.bancontact ? 'outline' : 'default'} className="h-14 text-base" onClick={() => place('counter')} disabled={placing || lines.length === 0}>
              {placing ? m.placing : m.place}
            </Button>
          </section>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button variant="ghost" size="lg" className="h-12" onClick={() => setStep(1)} disabled={placing}>
          {m.steps.cart}
        </Button>
      </div>
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

function Follow({ token, onStartOver, onOrderMore }: { token: string; onStartOver?: () => void; onOrderMore?: (modeId: string | null) => void }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const { status, error, live, refresh } = useFollow(token)

  // Everything collected (and, on a tab, paid): a self-order phone goes back to the menu.
  useEffect(() => {
    if (status?.state !== 'delivered' || status.tabOpen || !onStartOver) return
    const t = setTimeout(onStartOver, 6000)
    return () => clearTimeout(t)
  }, [status?.state, status?.tabOpen, onStartOver])

  // Order more from a follow page opened on its own (back from Bancontact in
  // another browser): this browser remembers the tab, then the menu.
  function orderMore() {
    if (onOrderMore) return onOrderMore(status?.modeId ?? null)
    if (!status?.selfOrderCode) return
    save(status.selfOrderCode, { cart: {}, token, modeId: status.modeId ?? null })
    window.location.assign(`/bestel/${status.selfOrderCode}`)
  }

  if (!status) return <p className="py-10 text-center text-muted-foreground" role={error ? 'alert' : undefined}>{error ?? m.loading}</p>

  const places = readyPlaces(status)
  const ready = status.state === 'ready' || places.length > 0
  return (
    <div className="flex flex-col gap-4" data-testid="follow" data-state={status.state}>
      <section className={`flex flex-col items-center gap-1 rounded-2xl p-6 text-center ring-1 ${ready ? 'bg-emerald-500/15 ring-emerald-500/50' : 'bg-card ring-foreground/10'}`}>
        <p className="text-sm text-muted-foreground">{status.tabOpen ? m.yourTab(status.number) : m.yourNumber}</p>
        <p className="text-7xl font-black tabular-nums" data-testid="order-number">{status.number}</p>
        {status.mode && <p className="rounded-full bg-muted px-3 py-0.5 text-sm font-semibold" data-testid="order-mode">{status.mode}</p>}
        {ready && <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300" role="status">{m.ready}</p>}
        <p className="mt-2 text-base font-medium" data-testid="follow-message">{message(m, status, places)}</p>
      </section>

      {status.state === 'awaiting_payment' && status.payment?.bancontact && <PayAgain token={token} status={status} />}

      {status.tabOpen && (
        <div className="flex flex-col gap-3">
          <Button size="lg" className="h-14 text-base" onClick={orderMore} data-testid="order-more">
            {m.addRoundTitle}
          </Button>
          <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="settle">
            <h2 className="text-lg font-bold">
              {m.settleTitle} · <span className="tabular-nums">{formatEuro(status.totalCents)}</span>
            </h2>
            {status.payment?.counter !== false && <p className="text-sm">{m.settleCounter(status.number)}</p>}
            {status.payment?.bancontact && <PayAgain token={token} status={status} inline />}
          </section>
        </div>
      )}

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

      {status.sms && (status.sms.available || status.sms.stations.length > 0) && <SmsCard token={token} sms={status.sms} onChanged={refresh} />}

      {!isDone(status) && !storageWorks() && <KeepLink token={token} number={status.number} />}

      {!isDone(status) && (
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

      {!status.tabOpen && (status.state === 'cancelled' || status.state === 'delivered' || status.state === 'nothing_to_prepare') && (onStartOver || status.selfOrderCode) && (
        onStartOver ? (
          <Button size="lg" className="h-12" onClick={onStartOver}>
            {m.newOrder}
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12"
            onClick={() => {
              // A new order: this phone forgets the old one and its way of ordering.
              save(status.selfOrderCode!, { cart: {}, token: null, modeId: null })
              window.location.assign(`/bestel/${status.selfOrderCode}`)
            }}
          >
            {m.newOrder}
          </Button>
        )
      )}
    </div>
  )
}

// "Text me when it's ready" (MESSAGING.md): a number, shown back masked
// ("••• 56"), changeable; and per station whether its SMS went.
function SmsCard({ token, sms, onChanged }: { token: string; sms: NonNullable<FollowStatus['sms']>; onChanged: () => void }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const path = `/api/public/orders/${encodeURIComponent(token)}/notify`
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await call(path, { method: 'POST', body: JSON.stringify({ phone }) })
      setEditing(false)
      setPhone('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const asking = sms.available && (!sms.phone || editing)
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="sms">
      <h2 className="font-semibold">{m.smsTitle}</h2>
      {asking && (
        <form className="flex flex-col gap-2" onSubmit={save}>
          <p className="text-sm text-muted-foreground">{m.smsHint}</p>
          <label className="sr-only" htmlFor="sms-phone">{m.smsPhone}</label>
          <input
            id="sms-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={m.smsPlaceholder}
            className="h-12 w-full min-w-0 rounded-lg border bg-background px-3 text-base"
          />
          <Button type="submit" size="lg" className="h-12" disabled={busy || !phone.trim()}>
            {busy ? m.placing : m.smsSubmit}
          </Button>
          <p className="text-xs text-muted-foreground">{m.smsPrivacy}</p>
        </form>
      )}
      {sms.available && sms.phone && !editing && (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm" data-testid="sms-phone">{m.smsSet(sms.phone)}</p>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            {m.smsChange}
          </Button>
        </div>
      )}
      {sms.stations.map((s) => (
        <p key={s.name} className={`text-sm ${s.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="sms-station">
          {s.status === 'failed' ? m.smsFailed(s.name) : s.status === 'sent' ? `✓ ${m.smsSent(s.name)}` : '…'}
        </p>
      ))}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </section>
  )
}

// The follow page's own link, to keep: a private window forgets it, and so
// does a closed tab. The phone's share sheet (a message to themselves, …)
// where there is one, and copying it everywhere.
function KeepLink({ token, number }: { token: string; number: number }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/volg/${token}`
  const canShare = typeof navigator.share === 'function'
  async function share() {
    try {
      await navigator.share({ title: m.shareText(number), text: m.shareText(number), url })
    } catch {
      // cancelled
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt(m.copyLink, url)
    }
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="keep-link">
      <h2 className="font-semibold">{m.keepLink}</h2>
      <p className="text-sm text-muted-foreground">{m.keepLinkHint}</p>
      <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : ''}`}>
        {canShare && (
          <Button variant="outline" size="lg" className="h-12" onClick={share}>
            <Share2 aria-hidden="true" />
            {m.share}
          </Button>
        )}
        <Button variant="outline" size="lg" className="h-12" onClick={copy} data-testid="copy-link">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? m.linkCopied : m.copyLink}
        </Button>
      </div>
    </section>
  )
}

// Waiting for payment, Bancontact allowed: the payment in progress (open the
// app again), a failed one (try again), or none yet — and the counter as the
// alternative when the event takes it.
function PayAgain({ token, status, inline = false }: { token: string; status: FollowStatus; inline?: boolean }) {
  const m = useMessages(SELF_ORDER_MESSAGES)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pay = status.payment!
  async function go() {
    setBusy(true)
    setError(null)
    try {
      await payWithBancontact(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={inline ? 'flex flex-col gap-3' : 'flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10'} data-testid="pay-again">
      {pay.pending && <p className="font-medium">{m.bancontactPending}</p>}
      {pay.failed && <p className="font-medium text-destructive">{m.bancontactFailed}</p>}
      <Button size="lg" variant={inline ? 'outline' : 'default'} className="h-14 text-base" onClick={go} disabled={busy}>
        {busy ? m.placing : pay.pending ? m.bancontactOpen : pay.failed ? m.bancontactRetry : inline ? m.settleBancontact : m.payBancontact}
      </Button>
      {pay.counter && !inline && <p className="text-sm text-muted-foreground">{m.orAtCounter(status.number)}</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </section>
  )
}

function message(m: ReturnType<typeof useMessages<typeof SELF_ORDER_MESSAGES.nl>>, status: FollowStatus, places: string[]): string {
  switch (status.state) {
    case 'awaiting_payment':
      return status.payment?.bancontact ? m.payNow : m.goPay(status.number)
    case 'cancelled':
      return m.cancelled
    case 'nothing_to_prepare':
      return m.nothingToPrepare
    case 'delivered':
      return status.tabOpen ? m.tabDelivered : m.delivered
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
  // The current refresh, for a change made on the page itself (a number for the SMS).
  const refreshRef = useRef<() => void>(() => {})

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
        if (isDone(next)) socket?.close()
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
        if (!stopped && !(previous.current && isDone(previous.current))) reconnectLater()
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

    refreshRef.current = refresh
    refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      socket?.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token])

  return { status, error, live, refresh: () => refreshRef.current() }
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
