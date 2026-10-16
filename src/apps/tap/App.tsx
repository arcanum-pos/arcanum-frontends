import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/shared/api-errors'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { isIos, isStandalone, pushSupport, subscribePush, unsubscribePush } from '@/shared/push'
import { sumupAppLink } from '@/shared/sumup-app'
import { connectNotifications, getRegisteredTerminal, pairDevice, type Terminal } from '@/shared/terminal'
import { readTapAddress, tapReturnUrl, type TapAddress } from './lib'
import { TAP_MESSAGES } from './messages'

// A kassa's Tap to Pay phone (2026-10-16). Paired with a code for one kassa
// (from this page itself: on an iPhone the home-screen app keeps its own
// cookies, apart from Safari's). When the cashier picks "Tap to Pay" the
// payment appears here — live over the notification socket, or as a
// notification while the phone is locked — and one tap opens the SumUp app
// with the amount; back here, the backend asks SumUp whether it's paid.
//
// The kassa's QR opens this page for one payment (/tap?charge=…&t=…) on any
// phone with the SumUp app, paired or not.

interface TapCharge {
  chargeId: string
  token: string
  status: 'pending' | 'succeeded' | 'failed'
  amountCents: number
  title: string
  errorMessage: string | null
  sumupApp: { affiliateKey: string; appId: string } | null
}

interface TapState {
  name: string | null
  kassa: { terminalId: string; name: string | null } | null
  charge: TapCharge | null
  push: { publicKey: string; subscribed: boolean } | null
}

const TAP_SCOPE = '/tap'

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { status: res.status, code: data?.code })
  return data as T
}

const chargePath = (a: { chargeId: string; token: string }) => `/api/public/tap/${encodeURIComponent(a.chargeId)}/${encodeURIComponent(a.token)}`

export default function App() {
  const m = useMessages(TAP_MESSAGES)
  // One payment by its address (the QR, or back from the SumUp app).
  const [address, setAddress] = useState<TapAddress | null>(() => readTapAddress(window.location.search))
  const [terminal, setTerminal] = useState<Terminal | null | undefined>(undefined)

  useEffect(() => {
    getRegisteredTerminal('tap').then(setTerminal)
  }, [])

  // Done with that one payment: back to the phone's own page (if it's paired).
  function leaveAddress() {
    window.history.replaceState(null, '', '/tap')
    setAddress(null)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-4 px-4 py-6">
        <h1 className="text-lg font-semibold">{m.title}</h1>
        {address ? (
          <AddressedPayment address={address} onDone={terminal ? leaveAddress : null} />
        ) : terminal === undefined ? (
          <p className="text-muted-foreground">{m.loading}</p>
        ) : terminal ? (
          <PairedPhone terminal={terminal} />
        ) : (
          <PairForm onPaired={setTerminal} />
        )}
      </main>
    </div>
  )
}

// --- Not paired yet ---

function PairForm({ onPaired }: { onPaired: (t: Terminal) => void }) {
  const m = useMessages(TAP_MESSAGES)
  // The console's QR opens /tap?code=… — filled in.
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iosInSafari = isIos() && !isStandalone()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const device = await pairDevice(code)
      if (device.role !== 'tap') {
        setError(m.wrongRole)
        return
      }
      onPaired({ terminalId: device.terminalId, role: 'tap', orgId: device.orgId, orgName: device.orgName, name: device.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {iosInSafari && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="tap-ios-first">
          <h2 className="font-semibold">{m.iosFirstTitle}</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {m.iosFirst.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">{m.iosFirstWhy}</p>
        </section>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="tap-pair">
        <h2 className="font-semibold">{m.pairTitle}</h2>
        <p className="text-sm text-muted-foreground">{m.pairHint}</p>
        <label className="flex flex-col gap-1 text-sm">
          {m.pairCode}
          <Input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="XXXX-XXXX" className="h-12 font-mono text-lg tracking-widest" />
        </label>
        <Button type="submit" size="lg" className="h-12" disabled={busy || code.trim().length < 8}>
          {m.pair}
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>
    </>
  )
}

// --- Paired: its kassa's payment ---

function PairedPhone({ terminal }: { terminal: Terminal }) {
  const m = useMessages(TAP_MESSAGES)
  const [state, setState] = useState<TapState | null>(null)
  const path = `/api/organizations/${encodeURIComponent(terminal.orgId)}/devices/${encodeURIComponent(terminal.terminalId)}`

  const refresh = useCallback(() => {
    call<TapState>(`${path}/tap`)
      .then(setState)
      .catch((err) => {
        // Removed in the console: start over with a new code.
        if ((err as { status?: number }).status === 401 || (err as { status?: number }).status === 403) window.location.reload()
      })
  }, [path])

  useEffect(() => {
    refresh()
    // The kassa's payment events (devicehub sends them to its linked phone).
    const socket = connectNotifications(terminal.terminalId, {
      payment_updated: () => refresh(),
      reset: () => refresh(),
      linked: () => refresh(),
      unlinked: () => refresh(),
    })
    // Back in front (a notification tapped, the phone unlocked): look again.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      socket.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [terminal.terminalId, refresh])

  if (!state) return <p className="text-muted-foreground">{m.loading}</p>
  return (
    <>
      <p className="text-sm text-muted-foreground" data-testid="tap-kassa">
        {state.kassa ? m.forKassa(state.kassa.name || '') : m.noKassa}
      </p>
      {state.charge ? (
        <PayCard charge={state.charge} />
      ) : (
        <section className="flex flex-col items-center gap-2 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10" data-testid="tap-waiting">
          <p className="font-medium">{m.waiting}</p>
          <p className="text-sm text-muted-foreground">{m.waitingHint}</p>
        </section>
      )}
      {state.push && <PushCard path={`${path}/push`} push={state.push} onChanged={refresh} />}
    </>
  )
}

// --- One payment, by its address ---

function AddressedPayment({ address, onDone }: { address: TapAddress; onDone: (() => void) | null }) {
  const m = useMessages(TAP_MESSAGES)
  const [charge, setCharge] = useState<TapCharge | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let stopped = false
    // Back from the SumUp app: the backend asks SumUp now. Otherwise: just look.
    const load = address.returned !== null
      ? call<TapCharge>(`${chargePath(address)}/return`, { method: 'POST', body: JSON.stringify({ status: address.returned }) })
      : call<TapCharge>(chargePath(address))
    load.then((c) => !stopped && setCharge(c)).catch(() => !stopped && setGone(true))
    return () => {
      stopped = true
    }
  }, [address])

  // Still pending after the app came back: SumUp may need a moment — look again.
  useEffect(() => {
    if (!charge || charge.status !== 'pending' || address.returned === null) return
    const timer = setTimeout(() => {
      call<TapCharge>(`${chargePath(address)}/return`, { method: 'POST', body: JSON.stringify({ status: address.returned }) })
        .then(setCharge)
        .catch(() => {})
    }, 3000)
    return () => clearTimeout(timer)
  }, [charge, address])

  if (gone)
    return (
      <>
        <p className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10" role="alert" data-testid="tap-gone">
          {m.gone}
        </p>
        {onDone && <Button onClick={onDone}>{m.done}</Button>}
      </>
    )
  if (!charge) return <p className="text-muted-foreground">{m.loading}</p>
  return (
    <>
      <PayCard charge={charge} checking={address.returned !== null && charge.status === 'pending'} />
      {onDone && charge.status !== 'pending' && (
        <Button variant="outline" onClick={onDone}>
          {m.done}
        </Button>
      )}
    </>
  )
}

// The amount and the link that opens the SumUp app; or how it went.
function PayCard({ charge, checking = false }: { charge: TapCharge; checking?: boolean }) {
  const m = useMessages(TAP_MESSAGES)
  const link = charge.sumupApp
    ? sumupAppLink({
        ...charge.sumupApp,
        amountCents: charge.amountCents,
        title: charge.title,
        chargeId: charge.chargeId,
        returnUrl: tapReturnUrl(window.location.origin, charge.chargeId, charge.token),
      })
    : null
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10" data-testid="tap-charge" data-status={charge.status}>
      <p className="text-sm text-muted-foreground">{m.toPay}</p>
      <p className="font-mono text-[42px] leading-none font-semibold tabular-nums" data-testid="tap-amount">
        {formatEuro(charge.amountCents)}
      </p>
      {charge.status === 'succeeded' ? (
        <div className="flex flex-col items-center gap-1" data-testid="tap-paid">
          <span className="flex size-[54px] items-center justify-center rounded-full bg-green-100 text-[26px] text-green-700 dark:bg-green-950 dark:text-green-300" aria-hidden="true">
            ✓
          </span>
          <p className="font-semibold">{m.paid}</p>
          <p className="text-sm text-muted-foreground">{m.paidHint}</p>
        </div>
      ) : charge.status === 'failed' ? (
        <div className="flex flex-col items-center gap-1" data-testid="tap-failed">
          <p className="font-semibold text-destructive">{m.failed}</p>
          <p className="text-sm text-muted-foreground">{charge.errorMessage || m.failedHint}</p>
        </div>
      ) : !link ? (
        <p className="text-sm text-destructive" role="alert">
          {m.notSetUp}
        </p>
      ) : checking ? (
        <>
          <p className="text-sm" data-testid="tap-checking">
            {m.checking}
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href={link}>{m.tryAgain}</a>
          </Button>
        </>
      ) : (
        <>
          {/* A link (a tap opens the SumUp app): sumupmerchant://pay/1.0?… */}
          <Button asChild size="lg" className="h-14 w-full text-base">
            <a href={link} data-testid="tap-pay">
              {m.payButton}
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">{m.payHint}</p>
        </>
      )}
    </section>
  )
}

// --- Notifications (Web Push) ---

function PushCard({ path, push, onChanged }: { path: string; push: NonNullable<TapState['push']>; onChanged: () => void }) {
  const m = useMessages(TAP_MESSAGES)
  const [support] = useState(pushSupport)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      const subscription = await subscribePush(push.publicKey, TAP_SCOPE)
      if (subscription === 'denied') return setError(m.pushDenied)
      await call(path, { method: 'POST', body: JSON.stringify({ subscription }) })
      onChanged()
    } catch {
      setError(m.pushFailed)
    } finally {
      setBusy(false)
    }
  }
  async function turnOff() {
    setBusy(true)
    try {
      await call(path, { method: 'DELETE' })
      await unsubscribePush(TAP_SCOPE).catch(() => {})
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  // An iPhone in Safari never gets here paired (it pairs from the home screen).
  if (support !== 'yes' && !push.subscribed) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="tap-push">
      <h2 className="font-semibold">{m.pushTitle}</h2>
      {push.subscribed ? (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm" data-testid="tap-push-on">
            🔔 {m.pushSet}
          </p>
          <Button variant="ghost" size="sm" className="shrink-0" disabled={busy} onClick={turnOff}>
            {m.pushOff}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{m.pushHint}</p>
          <Button size="lg" className="h-12" disabled={busy} onClick={turnOn} data-testid="tap-push-turn-on">
            🔔 {m.pushOn}
          </Button>
        </>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
