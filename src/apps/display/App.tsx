import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { customerBill, readCustomerOrder, type CustomerOrder } from '@/shared/customer-order'
import { formatEuro } from '@/shared/format'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { CASH_VIEW_LABELS, METHOD_LABELS, PAY_INSTRUCTIONS, payPhase, STATUS_LABELS, type PayPhase } from './lib'

// Customer-facing display, three states: rust (idle), waiting for the
// payment (the order, the total and — for Bancontact — the QR), and paid.
// Styled after design_files/ (Kassa + CFD voorstel); no platform branding.
//
// Reacts to a payment two ways:
//  - same-device BroadcastChannel('arcanum-payment') — kassa and this page
//    open as two tabs/windows on the same machine; the kassa sends the
//    whole payment, order included.
//  - cross-device, via arcanum-devicehub's notification socket — carries
//    only an event name + id, never real data, so every event here
//    triggers a real, session-checked fetch through the BFF first (the
//    charge status carries the order too).
const WORKER_URL = '/api/bancontact'

interface Payment {
  method: string
  amountCents: number
  tipCents: number
  order: CustomerOrder | null
  qrCodeUrl?: string
  expiresAt?: string
  // The raw status (Bancontact's own, or AWAITING_MANUAL/RESOLVED, or pending/succeeded/failed).
  status: string
  errorMessage?: string
}

export default function App() {
  const [payment, setPayment] = useState<Payment | null>(null)
  // The event the kassa sells for, if any: from a same-device kassa, or
  // learned from the last payment's order (a CFD on another device).
  const [eventName, setEventName] = useState<string | null>(null)
  const [countdownText, setCountdownText] = useState('')
  const [terminalHint, setTerminalHint] = useState('')
  const [linkedHint, setLinkedHint] = useState('')
  const channelRef = useRef<BroadcastChannel | null>(null)

  function showIdle() {
    setPayment(null)
  }

  // A newer message about the same payment keeps what it doesn't repeat
  // (e.g. a status-only update keeps the order and the QR).
  function showPayment(next: Partial<Payment> & { method: string }) {
    if (next.order?.eventName) setEventName(next.order.eventName)
    setPayment((prev) => ({
      method: next.method,
      amountCents: next.amountCents ?? prev?.amountCents ?? 0,
      tipCents: next.tipCents ?? prev?.tipCents ?? 0,
      order: next.order ?? prev?.order ?? null,
      qrCodeUrl: next.qrCodeUrl ?? prev?.qrCodeUrl,
      expiresAt: next.expiresAt ?? prev?.expiresAt,
      status: next.status ?? prev?.status ?? 'PENDING',
      errorMessage: next.errorMessage,
    }))
  }

  function setStatus(status: string) {
    setPayment((prev) => (prev ? { ...prev, status } : prev))
  }

  async function fetchAndShowTrackedPayment(paymentId: string) {
    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${encodeURIComponent(paymentId)}`)
      if (!res.ok) return
      const data = await res.json()
      showPayment({
        method: data.method || 'sumup',
        amountCents: data.amountCents,
        tipCents: data.tipCents || 0,
        order: readCustomerOrder(data.order),
        qrCodeUrl: data.qrCodeUrl || undefined,
        expiresAt: data.expiresAt || undefined,
        status: data.providerStatus || data.status,
        errorMessage: data.status === 'failed' ? data.errorMessage || undefined : undefined,
      })
    } catch (err) {
      console.error('Kon betaalstatus niet ophalen', err)
    }
  }

  // Cross-device notifications (arcanum-devicehub) + this browser's own
  // terminal identity. A POS's "Klantscherm openen" button spawns a
  // brand-new CFD, links it to itself, and opens this page with
  // `?terminal=<id>` — that id is already registered and linked by the
  // opener, so it's used as-is here rather than going through the normal
  // localStorage-based flow. Opened directly/standalone (a real second
  // device that went through the chooser), there's no query param and the
  // normal flow applies unchanged.
  useEffect(() => {
    let socket: ReturnType<typeof connectNotifications> | null = null
    const linkedTerminalId = new URLSearchParams(window.location.search).get('terminal')
    const resolve = linkedTerminalId ? Promise.resolve({ terminalId: linkedTerminalId }) : getRegisteredTerminal('cfd')

    resolve.then((terminal) => {
      if (!terminal) {
        window.location.replace('/')
        return
      }

      setTerminalHint(`CFD-ID: ${terminal.terminalId}`)
      setLinkedHint('status laden...')

      socket = connectNotifications(terminal.terminalId, {
        linked: (msg) => setLinkedHint(`gekoppeld aan kassa ${msg.pos_terminal_id}`),
        unlinked: () => setLinkedHint('niet gekoppeld aan een kassa'),
        payment_updated: (msg) => fetchAndShowTrackedPayment(msg.payment_id),
        reset: () => showIdle(),
      })
    })

    return () => socket?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const channel = new BroadcastChannel('arcanum-payment')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'payment') {
        showPayment({
          method: msg.method,
          amountCents: msg.amountCents,
          tipCents: msg.tipCents || 0,
          order: readCustomerOrder(msg.order),
          qrCodeUrl: msg.qrCodeUrl,
          expiresAt: msg.expiresAt,
          status: msg.status,
        })
      } else if (msg.type === 'status') {
        setStatus(msg.status)
      } else if (msg.type === 'reset') {
        showIdle()
      } else if (msg.type === 'context') {
        setEventName(typeof msg.eventName === 'string' && msg.eventName.trim() ? msg.eventName.trim() : null)
      }
    }

    channel.postMessage({ type: 'request-state' })

    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phase: PayPhase | null = payment ? payPhase(payment.status) : null

  useEffect(() => {
    if (phase !== 'waiting' || !payment?.qrCodeUrl || !payment.expiresAt) {
      setCountdownText('')
      return
    }
    const expiryTime = new Date(payment.expiresAt).getTime()
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((expiryTime - Date.now()) / 1000))
      setCountdownText(secondsLeft > 0 ? `Vervalt over ${secondsLeft}s` : 'Verlopen')
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [phase, payment?.qrCodeUrl, payment?.expiresAt])

  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground">
      {!payment && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          {eventName && (
            <h1 className="text-[38px] font-semibold tracking-tight" data-testid="cfd-event">
              {eventName}
            </h1>
          )}
          <p className="max-w-md text-xl text-muted-foreground">Klaar voor de volgende bestelling</p>
        </div>
      )}

      {payment && phase !== 'paid' && <WaitingView payment={payment} eventName={eventName} failed={phase === 'failed'} countdownText={countdownText} />}

      {payment && phase === 'paid' && <PaidView payment={payment} eventName={eventName} onTap={() => channelRef.current?.postMessage({ type: 'reset-requested' })} />}

      <button
        type="button"
        className={cn(
          'fixed right-4 bottom-4 rounded-lg px-2.5 py-1 text-xs opacity-40 transition-opacity hover:opacity-100',
          payment ? 'bg-neutral-800 text-neutral-200' : 'bg-secondary text-secondary-foreground'
        )}
        onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
      >
        Volledig scherm
      </button>

      <p className={cn('fixed bottom-2 left-2 text-xs', payment ? 'text-neutral-500' : 'text-muted-foreground')}>
        {terminalHint}
        {linkedHint && ` — ${linkedHint}`}
      </p>
    </div>
  )
}

// Waiting for the payment: the order on the left ("Jouw bestelling"), the
// total and how to pay on the right — for Bancontact with the QR.
function WaitingView({ payment, eventName, failed, countdownText }: { payment: Payment; eventName: string | null; failed: boolean; countdownText: string }) {
  const bill = customerBill(payment.order, payment.amountCents, payment.tipCents)
  const method = METHOD_LABELS[payment.method] || payment.method
  const showQr = payment.method === 'bancontact' && !!payment.qrCodeUrl && !failed
  const statusText = failed
    ? payment.errorMessage || `Betaling ${(STATUS_LABELS[payment.status.toUpperCase()] || 'mislukt').toLowerCase()} — vraag het aan de toog`
    : payment.method === 'bancontact'
      ? payment.status.toUpperCase() === 'PENDING'
        ? 'Wachten op je betaling…'
        : `${STATUS_LABELS[payment.status.toUpperCase()] || 'Wachten op je betaling'}…`
      : CASH_VIEW_LABELS[payment.method] || 'Wachten op je betaling…'

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-neutral-950 md:flex-row" data-testid="cfd-waiting">
      {bill.lines.length > 0 && (
        <section className="flex min-w-0 flex-col bg-white text-neutral-950 md:flex-[1.25]">
          <div className="border-b border-neutral-200 px-8 pt-7 pb-4">
            <p className="text-xs font-semibold tracking-[0.1em] text-neutral-500 uppercase">Jouw bestelling</p>
            {bill.title && <h1 className="mt-1 text-2xl font-semibold tracking-tight">{bill.title}</h1>}
          </div>
          <ul className="flex-1 overflow-y-auto px-8 pt-1.5 pb-6">
            {bill.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-neutral-100 py-3">
                <span className="flex h-7 min-w-9 items-center justify-center rounded-lg bg-neutral-100 px-2 font-mono text-sm font-semibold text-neutral-700">{l.quantity}</span>
                <span className="flex-1 text-lg font-medium tracking-tight">{l.name}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatEuro(l.totalCents)}</span>
              </li>
            ))}
            {bill.alreadyPaidCents > 0 && (
              <li className="flex items-center justify-between py-3 text-neutral-500">
                <span className="text-base">Al betaald</span>
                <span className="font-mono text-base tabular-nums">− {formatEuro(bill.alreadyPaidCents)}</span>
              </li>
            )}
            {bill.tipCents > 0 && (
              <li className="flex items-center justify-between py-3 text-neutral-500">
                <span className="text-base">Fooi</span>
                <span className="font-mono text-base tabular-nums">{formatEuro(bill.tipCents)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className={cn('flex flex-col justify-between gap-8 p-8 text-neutral-50', bill.lines.length > 0 ? 'md:max-w-[520px] md:min-w-[360px] md:flex-[0_0_38%]' : 'flex-1 items-center justify-center text-center')}>
        <div>
          {(payment.order?.eventName || eventName) && (
            <p className="mb-6 truncate text-sm font-medium text-neutral-400" data-testid="cfd-event">
              {payment.order?.eventName || eventName}
            </p>
          )}
          <p className="text-xs font-semibold tracking-[0.1em] text-neutral-400 uppercase">Totaal te betalen</p>
          <p className="mt-2 font-mono text-[56px] leading-none font-semibold tracking-tight tabular-nums">{formatEuro(bill.amountCents)}</p>
          <p className="mt-3 text-[13.5px] text-neutral-400">
            {bill.itemCount > 0 && `${bill.itemCount === 1 ? '1 item' : `${bill.itemCount} items`} · `}
            {method}
          </p>
        </div>

        <div className={cn('flex flex-col gap-4', bill.lines.length === 0 && 'items-center')}>
          {showQr && (
            <div className={cn('rounded-2xl bg-white p-4', bill.lines.length > 0 ? 'self-start' : 'self-center')}>
              <img src={payment.qrCodeUrl} alt="QR-code voor betaling" className="size-[min(70vw,300px)]" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="relative inline-flex size-3 shrink-0" aria-hidden="true">
              <span className={cn('absolute inset-0 rounded-full', failed ? 'bg-red-500' : 'bg-amber-400')} />
              {!failed && <span className="absolute -inset-1.5 animate-ping rounded-full bg-amber-400/60" />}
            </span>
            <span className="text-lg text-neutral-200" data-testid="cfd-status">
              {statusText}
            </span>
          </div>
          {!failed && <p className="max-w-[340px] text-[13.5px] text-neutral-500">{PAY_INSTRUCTIONS[payment.method] || ''}</p>}
          {countdownText && <p className="font-mono text-xs text-neutral-500">{countdownText}</p>}
        </div>
      </section>
    </div>
  )
}

// Paid: a calm confirmation (design_files' "Bedankt!"), not a pop-up. A tap
// tells a same-device kassa the customer is done (it moves on to the next).
function PaidView({ payment, eventName, onTap }: { payment: Payment; eventName: string | null; onTap: () => void }) {
  const method = METHOD_LABELS[payment.method] || payment.method
  return (
    <div
      className="flex min-h-svh flex-1 cursor-pointer flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50 animate-in fade-in duration-300"
      onClick={onTap}
      data-testid="cfd-paid"
    >
      <div className="flex size-20 items-center justify-center rounded-full bg-green-600 text-4xl text-white animate-in zoom-in-50 duration-300" aria-hidden="true">
        ✓
      </div>
      <p className="text-[42px] font-semibold tracking-tight">Bedankt!</p>
      <p className="font-mono text-xl text-neutral-300">
        {formatEuro(payment.amountCents)} betaald · {method}
      </p>
      {(payment.order?.eventName || eventName) && (
        <p className="mt-2 text-sm text-neutral-500" data-testid="cfd-event">
          {payment.order?.eventName || eventName}
        </p>
      )}
    </div>
  )
}
