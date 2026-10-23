import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { QRCodeSVG } from 'qrcode.react'
import { customerBill, mergeCustomerLines, readCustomerOrder, type CustomerOrder } from '@/shared/customer-order'
import { formatEuro } from '@/shared/format'
import { useLocale, useMessages } from '@/shared/i18n'
import { LanguagePicker } from '@/shared/i18n/language-picker'
import { ThemePicker } from '@/shared/theme-picker'
import { STATUS_MESSAGES } from '@/shared/payment-labels'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { payPhase, type PayPhase } from './lib'
import { DISPLAY_MESSAGES } from './messages'
import { showOrgIcons } from '@/shared/install'
import { fetchBranding, NO_BRANDING, textOn, type Branding } from '@/shared/branding'

// How often a resting display looks again for new branding (the console changed it).
const BRANDING_REFRESH_MS = 5 * 60_000

// Customer-facing display, four states: rust (idle), the order while the
// cashier enters it (the customer checks it before paying, 2026-10-18),
// waiting for the payment (the order, the total and — for Bancontact — the
// QR), and paid. A payment always goes before the order being entered.
// Styled after design_files/ (Kassa + CFD voorstel); no platform branding.
// Follows the device's theme (light/dark, see shared/theme.ts): rust, the
// order list and "Bedankt!" in the theme itself, the payment panel beside
// the order list in the opposite one — a light order list with a dark
// payment panel in light mode, and the mirror in dark mode.
//
// Reacts to a payment two ways:
//  - same-device BroadcastChannel('arcanum-payment') — kassa and this page
//    open as two tabs/windows on the same machine; the kassa sends the
//    whole payment, order included.
//  - cross-device, via arcanum-devicehub's notification socket — carries
//    only an event name + id, never real data, so every event here
//    triggers a real, session-checked fetch through the BFF first (the
//    charge status carries the order too; `order_shown`: the order being
//    entered, from …/devices/:self/customer-view).
//
// Speaks nl/fr/en: the customer picks with the corner toggle, and it goes
// back to the device's own language (see main.tsx) when the display
// returns to rust, for the next customer.
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
  // One part of an equal split ("deel 2 van 3").
  part?: { index: number; of: number } | null
}

export default function App() {
  const m = useMessages(DISPLAY_MESSAGES)
  const { resetLocale } = useLocale()
  const [payment, setPayment] = useState<Payment | null>(null)
  // The event the kassa sells for, if any: from a same-device kassa, or
  // learned from the last payment's order (a CFD on another device).
  const [eventName, setEventName] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [terminalHint, setTerminalHint] = useState('')
  // Kept as a state, not a text, so it follows the language.
  const [link, setLink] = useState<{ state: 'loading' } | { state: 'linked'; posId: string } | { state: 'unlinked' } | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  // The order while the cashier enters it; `seq` the kassa's own counter —
  // the newest wins, whichever way (channel or backend) it came.
  const [entering, setEntering] = useState<CustomerOrder | null>(null)
  const enteringSeqRef = useRef(0)
  // Whose logo and colours: the org (the display's own, or a same-device
  // kassa's), the event's own colours where it has them (branding.ts).
  const [brandOrg, setBrandOrg] = useState<string | null>(null)
  const [brandEvent, setBrandEvent] = useState<string | null>(null)
  const [branding, setBranding] = useState<Branding>(NO_BRANDING)

  function showEntering(order: CustomerOrder | null, seq: unknown) {
    if (typeof seq !== 'number' || seq <= enteringSeqRef.current) return
    enteringSeqRef.current = seq
    setEntering(order)
    if (order?.eventName) setEventName(order.eventName)
    if (order?.eventId) setBrandEvent(order.eventId)
  }

  async function fetchEntering(orgId: string, terminalId: string) {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/devices/${encodeURIComponent(terminalId)}/customer-view`)
      if (!res.ok) return
      const data = await res.json()
      showEntering(readCustomerOrder(data.order), data.seq)
    } catch {
      // the next change brings it
    }
  }

  function showIdle() {
    setPayment(null)
    resetLocale()
  }

  // A newer message about the same payment keeps what it doesn't repeat
  // (e.g. a status-only update keeps the order and the QR).
  function showPayment(next: Partial<Payment> & { method: string }) {
    if (next.order?.eventName) setEventName(next.order.eventName)
    if (next.order?.eventId) setBrandEvent(next.order.eventId)
    setPayment((prev) => ({
      method: next.method,
      amountCents: next.amountCents ?? prev?.amountCents ?? 0,
      tipCents: next.tipCents ?? prev?.tipCents ?? 0,
      order: next.order ?? prev?.order ?? null,
      qrCodeUrl: next.qrCodeUrl ?? prev?.qrCodeUrl,
      expiresAt: next.expiresAt ?? prev?.expiresAt,
      status: next.status ?? prev?.status ?? 'PENDING',
      errorMessage: next.errorMessage,
      part: next.part !== undefined ? next.part : prev?.part,
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
        // Finished: the backend's own verdict (succeeded/failed) decides — a
        // provider's word for it ("successful" from SumUp) would otherwise
        // override the "paid" the kassa already sent over the channel.
        // Still pending: the provider's detail (Bancontact's IDENTIFIED…).
        status: data.status && data.status !== 'pending' ? data.status : data.providerStatus || data.status,
        errorMessage: data.status === 'failed' ? data.errorMessage || undefined : undefined,
        part: readPart(data.splitPart, data.order?.split?.parts),
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
      if ('orgId' in terminal) {
        showOrgIcons(terminal.orgId, 'display')
        setBrandOrg(terminal.orgId)
      }
      setLink({ state: 'loading' })

      // A display on its own device asks for its kassa's order being entered;
      // a kassa's second window gets it over the channel (below).
      const orgId = 'orgId' in terminal ? terminal.orgId : null
      if (orgId) void fetchEntering(orgId, terminal.terminalId)
      socket = connectNotifications(terminal.terminalId, {
        linked: (msg) => setLink({ state: 'linked', posId: String(msg.pos_terminal_id) }),
        unlinked: () => setLink({ state: 'unlinked' }),
        payment_updated: (msg) => fetchAndShowTrackedPayment(msg.payment_id),
        order_shown: () => orgId && fetchEntering(orgId, terminal.terminalId),
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
          part: readPart(msg.part?.index, msg.part?.of),
        })
      } else if (msg.type === 'status') {
        setStatus(msg.status)
      } else if (msg.type === 'reset') {
        showIdle()
      } else if (msg.type === 'order-view') {
        showEntering(readCustomerOrder(msg.order), msg.seq)
      } else if (msg.type === 'context') {
        setEventName(typeof msg.eventName === 'string' && msg.eventName.trim() ? msg.eventName.trim() : null)
        if (typeof msg.orgId === 'string' && msg.orgId) setBrandOrg(msg.orgId)
        setBrandEvent(typeof msg.eventId === 'string' && msg.eventId ? msg.eventId : null)
      }
    }

    channel.postMessage({ type: 'request-state' })

    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The branding for this org and event — and again now and then, so a change
  // in the console reaches a display that's left on all evening.
  useEffect(() => {
    if (!brandOrg) return
    let stopped = false
    const load = () =>
      fetchBranding(brandOrg, brandEvent)
        .then((b) => !stopped && setBranding(b))
        .catch(() => {})
    load()
    const timer = setInterval(load, BRANDING_REFRESH_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [brandOrg, brandEvent])
  const branded = !!(branding.primary || branding.accent || branding.logoUrl)
  const brandStyle = branded
    ? ({
        '--brand': branding.primary ?? '#0a0a0a',
        '--brand-fg': textOn(branding.primary ?? '#0a0a0a'),
        '--brand-accent': branding.accent ?? branding.primary ?? '#0a0a0a',
        '--brand-accent-fg': textOn(branding.accent ?? branding.primary ?? '#0a0a0a'),
      } as React.CSSProperties)
    : undefined
  const headerEvent = payment?.order?.eventName || entering?.eventName || eventName

  const linkedHint = !link ? '' : link.state === 'loading' ? m.loadingStatus : link.state === 'linked' ? m.linkedTo(link.posId) : m.notLinked
  const phase: PayPhase | null = payment ? payPhase(payment.status) : null

  useEffect(() => {
    if (phase !== 'waiting' || !payment?.qrCodeUrl || !payment.expiresAt) {
      setSecondsLeft(null)
      return
    }
    const expiryTime = new Date(payment.expiresAt).getTime()
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.round((expiryTime - Date.now()) / 1000)))
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [phase, payment?.qrCodeUrl, payment?.expiresAt])
  const countdownText = secondsLeft === null ? '' : secondsLeft > 0 ? m.expiresIn(secondsLeft) : m.expired

  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground" style={brandStyle} data-branded={branded || undefined}>
      {branded && <BrandHeader branding={branding} eventName={headerEvent} />}

      {!payment && entering && <EnteringView order={entering} eventName={eventName} branded={branded} />}

      {/* Rust: the same screen as while the order is entered — no lines yet, € 0,00. */}
      {!payment && !entering && <EnteringView order={null} eventName={eventName} branded={branded} />}

      {payment && phase !== 'paid' && <WaitingView payment={payment} eventName={eventName} failed={phase === 'failed'} countdownText={countdownText} branded={branded} />}

      {payment && phase === 'paid' && <PaidView payment={payment} eventName={eventName} branded={branded} onTap={() => channelRef.current?.postMessage({ type: 'reset-requested' })} />}

      <div className="fixed right-4 bottom-4 flex items-center gap-3">
        <ThemePicker />
        <LanguagePicker />
        <button
          type="button"
          className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-secondary-foreground opacity-40 transition-opacity hover:opacity-100"
          onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
        >
          {m.fullscreen}
        </button>
      </div>

      <p className="fixed bottom-2 left-2 text-xs text-muted-foreground">
        {terminalHint}
        {linkedHint && ` — ${linkedHint}`}
      </p>
    </div>
  )
}

// Branded: across the top, the main colour with the logo and the event's
// name, and under it a stripe in the accent (the scarf). The event's name
// then lives here, not in the payment panel.
function BrandHeader({ branding, eventName }: { branding: Branding; eventName: string | null }) {
  return (
    <header className="shrink-0" data-testid="cfd-brand">
      <div className={cn('flex min-h-20 items-center gap-5 px-8 py-3', branding.primary ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-b bg-background')}>
        {branding.logoUrl && <img src={branding.logoUrl} alt="" className="max-h-16 max-w-[40%] object-contain" data-testid="cfd-logo" />}
        {eventName && (
          <h1 className="min-w-0 truncate text-[28px] font-semibold tracking-tight" data-testid="cfd-brand-event">
            {eventName}
          </h1>
        )}
      </div>
      {branding.accent && <div className="h-1.5 bg-[var(--brand-accent)]" aria-hidden="true" />}
    </header>
  )
}

// The payment panel beside the order list: dark (light in dark mode) —
// branded, in the main colour with text that reads on it.
const PANEL = 'bg-neutral-950 text-neutral-50 dark:bg-white dark:text-neutral-950'
const PANEL_BRANDED = 'bg-[var(--brand)] text-[var(--brand-fg)]'
const PANEL_MUTED = 'text-neutral-400 dark:text-neutral-500'
const PANEL_MUTED_BRANDED = 'text-[var(--brand-fg)]/70'
// The quantity in front of a line.
const QTY = 'bg-muted text-foreground/75'
const QTY_BRANDED = 'bg-[var(--brand-accent)] text-[var(--brand-accent-fg)]'

function readPart(index: unknown, of: unknown): Payment['part'] {
  return Number.isInteger(index) && Number.isInteger(of) && (index as number) >= 1 && (of as number) >= (index as number) ? { index: index as number, of: of as number } : null
}

// Waiting for the payment: the order on the left ("Jouw bestelling"), the
// total and how to pay on the right — for Bancontact with the QR.
function WaitingView({ payment, eventName, failed, countdownText, branded }: { payment: Payment; eventName: string | null; failed: boolean; countdownText: string; branded: boolean }) {
  const m = useMessages(DISPLAY_MESSAGES)
  const statusLabels = useMessages(STATUS_MESSAGES)
  const bill = customerBill(payment.order, payment.amountCents, payment.tipCents)
  // Per item: the list is what this payment covers, not the whole rekening.
  const paying = payment.order?.paying ?? null
  const shownLines = paying ? mergeCustomerLines(paying).map((l) => ({ name: l.name, quantity: l.quantity, totalCents: l.quantity * l.unitPriceCents })) : bill.lines
  const partial = !!payment.part || !!paying
  const method = m.methods[payment.method] || payment.method
  const showQr = payment.method === 'bancontact' && !!payment.qrCodeUrl && !failed
  const statusText = failed
    ? payment.errorMessage || m.failed(statusLabels[payment.status.toUpperCase()] || m.failedFallback)
    : payment.method === 'bancontact'
      ? payment.status.toUpperCase() === 'PENDING'
        ? `${m.waiting}…`
        : `${statusLabels[payment.status.toUpperCase()] || m.waiting}…`
      : m.payWith[payment.method] || `${m.waiting}…`

  // Beside the order list, the payment panel takes the opposite of the theme
  // (dark on a light screen, white on a dark one); alone, it's the theme.
  const paired = shownLines.length > 0
  const muted = paired ? (branded ? PANEL_MUTED_BRANDED : PANEL_MUTED) : 'text-muted-foreground'

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background md:flex-row" data-testid="cfd-waiting">
      {paired && (
        <section className="flex min-w-0 flex-col bg-background text-foreground md:flex-[1.25]" data-testid="cfd-order">
          <div className="border-b px-8 pt-7 pb-4">
            <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">{paying ? m.yourShare : m.yourOrder}</p>
            {bill.title && <h1 className="mt-1 text-2xl font-semibold tracking-tight">{bill.title}</h1>}
          </div>
          <ul className="flex-1 overflow-y-auto px-8 pt-1.5 pb-6">
            {shownLines.map((l, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-border/60 py-3">
                <span className={cn('flex h-7 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-sm font-semibold', branded ? QTY_BRANDED : QTY)}>{l.quantity}</span>
                <span className="flex-1 text-lg font-medium tracking-tight">{l.name}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatEuro(l.totalCents)}</span>
              </li>
            ))}
            {!paying && bill.alreadyPaidCents > 0 && (
              <li className="flex items-center justify-between py-3 text-muted-foreground">
                <span className="text-base">{m.alreadyPaid}</span>
                <span className="font-mono text-base tabular-nums">− {formatEuro(bill.alreadyPaidCents)}</span>
              </li>
            )}
            {bill.tipCents > 0 && (
              <li className="flex items-center justify-between py-3 text-muted-foreground">
                <span className="text-base">{m.tip}</span>
                <span className="font-mono text-base tabular-nums">{formatEuro(bill.tipCents)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* The amount at the top; the QR and the status in the middle, clear of
          the corner controls (language, theme, full screen) at the bottom. */}
      <section
        className={cn(
          'flex flex-col gap-8 px-8 pt-8 pb-20',
          paired ? cn('md:max-w-[520px] md:min-w-[360px] md:flex-[0_0_38%]', branded ? PANEL_BRANDED : PANEL) : 'flex-1 bg-background text-center text-foreground'
        )}
        data-testid="cfd-pay"
      >
        <div>
          {!branded && (payment.order?.eventName || eventName) && (
            <p className={cn('mb-6 truncate text-sm font-medium', muted)} data-testid="cfd-event">
              {payment.order?.eventName || eventName}
            </p>
          )}
          <p className={cn('text-xs font-semibold tracking-[0.1em] uppercase', muted)}>
            {payment.part ? m.partDue(payment.part.index, payment.part.of) : m.totalDue}
          </p>
          <p className="mt-2 font-mono text-[56px] leading-none font-semibold tracking-tight tabular-nums">{formatEuro(bill.amountCents)}</p>
          <p className={cn('mt-3 text-[13.5px]', muted)} data-testid="cfd-summary">
            {partial
              ? `${m.stillOpen(formatEuro(bill.openCents))} · ${method}`
              : `${bill.itemCount > 0 ? `${m.items(bill.itemCount)} · ` : ''}${method}`}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          {showQr && (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <img src={payment.qrCodeUrl} alt={m.qrAlt} className="size-[min(70vw,300px)]" />
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <span className="relative inline-flex size-3 shrink-0" aria-hidden="true">
              <span className={cn('absolute inset-0 rounded-full', failed ? 'bg-red-500' : 'bg-amber-400')} />
              {!failed && <span className="absolute -inset-1.5 animate-ping rounded-full bg-amber-400/60" />}
            </span>
            <span className={cn('text-lg', paired ? (branded ? 'text-[var(--brand-fg)]' : 'text-neutral-200 dark:text-neutral-800') : 'text-foreground/85')} data-testid="cfd-status">
              {statusText}
            </span>
          </div>
          {!failed && <p className={cn('max-w-[340px] text-[13.5px]', muted)}>{m.instructions[payment.method] || ''}</p>}
          {countdownText && <p className={cn('font-mono text-xs', muted)}>{countdownText}</p>}
        </div>
      </section>
    </div>
  )
}

// While the cashier enters the order: the lines as they come, and the
// total — the customer checks it (and says so at the kassa) before paying.
// Without an order (rust): the same screen, empty, at € 0,00, ready for
// the next one — so the display doesn't change shape when an order starts.
function EnteringView({ order, eventName, branded }: { order: CustomerOrder | null; eventName: string | null; branded: boolean }) {
  const m = useMessages(DISPLAY_MESSAGES)
  const bill = customerBill(order, 0)
  const event = order?.eventName || eventName
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background md:flex-row" data-testid={order ? 'cfd-entering' : 'cfd-idle'}>
      <section className="flex min-w-0 flex-col bg-background text-foreground md:flex-[1.25]" data-testid="cfd-order">
        <div className="border-b px-8 pt-7 pb-4">
          <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">{m.yourOrder}</p>
          {bill.title && <h1 className="mt-1 text-2xl font-semibold tracking-tight">{bill.title}</h1>}
        </div>
        <ul className="flex-1 overflow-y-auto px-8 pt-1.5 pb-6">
          {bill.lines.map((l, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-border/60 py-3 animate-in fade-in duration-200">
              <span className={cn('flex h-7 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-sm font-semibold', branded ? QTY_BRANDED : QTY)}>{l.quantity}</span>
              <span className="flex-1 text-lg font-medium tracking-tight">{l.name}</span>
              <span className="font-mono text-lg font-semibold tabular-nums">{formatEuro(l.totalCents)}</span>
            </li>
          ))}
          {bill.alreadyPaidCents > 0 && (
            <li className="flex items-center justify-between py-3 text-muted-foreground">
              <span className="text-base">{m.alreadyPaid}</span>
              <span className="font-mono text-base tabular-nums">− {formatEuro(bill.alreadyPaidCents)}</span>
            </li>
          )}
        </ul>
      </section>
      <section className={cn('flex flex-col gap-8 px-8 pt-8 pb-20 md:max-w-[520px] md:min-w-[360px] md:flex-[0_0_38%]', branded ? PANEL_BRANDED : PANEL)} data-testid="cfd-total">
        <div>
          {!branded && event && (
            <p className={cn('mb-6 truncate text-sm font-medium', PANEL_MUTED)} data-testid="cfd-event">
              {event}
            </p>
          )}
          <p className={cn('text-xs font-semibold tracking-[0.1em] uppercase', branded ? PANEL_MUTED_BRANDED : PANEL_MUTED)}>{m.total}</p>
          <p className="mt-2 font-mono text-[56px] leading-none font-semibold tracking-tight tabular-nums" data-testid="cfd-entering-total">
            {formatEuro(bill.openCents)}
          </p>
          <p className={cn('mt-3 text-[13.5px]', branded ? PANEL_MUTED_BRANDED : PANEL_MUTED)}>{m.items(bill.itemCount)}</p>
        </div>
        <p className={cn('flex flex-1 items-center justify-center text-center text-lg', branded ? 'text-[var(--brand-fg)]' : 'text-neutral-200 dark:text-neutral-800')}>{order ? m.checkOrder : m.idle}</p>
      </section>
    </div>
  )
}

// Paid: a calm confirmation (design_files' "Bedankt!"), not a pop-up. A tap
// tells a same-device kassa the customer is done (it moves on to the next).
function PaidView({ payment, eventName, branded, onTap }: { payment: Payment; eventName: string | null; branded: boolean; onTap: () => void }) {
  const m = useMessages(DISPLAY_MESSAGES)
  const method = m.methods[payment.method] || payment.method
  return (
    <div
      className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground animate-in fade-in duration-300"
      onClick={onTap}
      data-testid="cfd-paid"
    >
      <div className="flex size-20 items-center justify-center rounded-full bg-green-600 text-4xl text-white animate-in zoom-in-50 duration-300" aria-hidden="true">
        ✓
      </div>
      <p className="text-[42px] font-semibold tracking-tight">{m.thanks}</p>
      <p className="font-mono text-xl text-foreground/80">
        {m.paid(formatEuro(payment.amountCents), method)}
      </p>
      {payment.part && (
        <p className="text-base text-muted-foreground" data-testid="cfd-part">
          {m.part(payment.part.index, payment.part.of)}
        </p>
      )}
      {!branded && (payment.order?.eventName || eventName) && (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="cfd-event">
          {payment.order?.eventName || eventName}
        </p>
      )}
      {payment.order?.followUrl && (
        <div className="mt-4 flex flex-col items-center gap-2" data-testid="cfd-follow">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={payment.order.followUrl} size={180} marginSize={1} title={m.followQrAlt} />
          </div>
          {payment.order.number !== null && <p className="text-2xl font-bold">{m.yourNumber(payment.order.number)}</p>}
          <p className="max-w-sm text-base text-muted-foreground">{m.followHint}</p>
        </div>
      )}
    </div>
  )
}
