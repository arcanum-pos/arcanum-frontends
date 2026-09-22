import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppBrand } from '@/shared/app-brand'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { CASH_VIEW_LABELS, STATUS_LABELS } from './lib'

// Customer-facing display. Reacts to a payment two ways, kept in sync
// manually since arcanum-webapp's kassa (app.ts, not migrated yet) still
// drives both:
//  - same-device BroadcastChannel('questo-payment') — kassa and this page
//    open as two tabs/windows on the same machine, origin-scoped so this
//    still works regardless of which Worker actually serves either page.
//  - cross-device, via arcanum-devicehub's notification socket — carries
//    only an event name + id, never real data, so every event here
//    triggers a real, session-checked fetch through the BFF first.
const WORKER_URL = '/api/bancontact'

interface PaymentInfo {
  method?: string
  qrCodeUrl?: string
  breakdown?: string[]
  amountCents?: number
  expiresAt?: string
}

function formatAmount(amountCents?: number): string {
  return Number.isInteger(amountCents) ? `€ ${(amountCents! / 100).toFixed(2).replace('.', ',')}` : ''
}

export default function App() {
  const [viewKind, setViewKind] = useState<'idle' | 'qr' | 'cash'>('idle')
  const [payment, setPayment] = useState<PaymentInfo>({})
  const [statusCode, setStatusCode] = useState('')
  const [cashStatusText, setCashStatusText] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [countdownText, setCountdownText] = useState('')
  const [terminalHint, setTerminalHint] = useState('')
  const [linkedHint, setLinkedHint] = useState('')

  const channelRef = useRef<BroadcastChannel | null>(null)

  function showIdleView() {
    setViewKind('idle')
    setShowSuccess(false)
    setPayment({})
  }

  function setStatus(status: string) {
    setStatusCode(status)
    if (status === 'SUCCEEDED') setShowSuccess(true)
  }

  function showQrView(p: PaymentInfo & { status?: string }) {
    setShowSuccess(false)
    setViewKind('qr')
    setPayment(p)
    setStatus(p.status || '')
  }

  function showCashView(p: PaymentInfo) {
    setShowSuccess(false)
    setViewKind('cash')
    setPayment(p)
    setCashStatusText(CASH_VIEW_LABELS[p.method || 'cash'] || CASH_VIEW_LABELS.cash)
  }

  async function fetchAndShowTrackedPayment(paymentId: string) {
    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${encodeURIComponent(paymentId)}`)
      if (!res.ok) return
      const data = await res.json()
      const method = data.method || 'sumup'

      // Bancontact: show the real QR (same view the same-device
      // BroadcastChannel path already uses) instead of the plain "please
      // pay" cash view — this is also what makes a genuinely separate CFD
      // device show the QR at all, not just avoid clobbering the
      // same-device BroadcastChannel view that was already showing it.
      if (method === 'bancontact' && data.qrCodeUrl) {
        showQrView({
          method,
          qrCodeUrl: data.qrCodeUrl,
          amountCents: data.amountCents,
          status: data.providerStatus || (data.status === 'succeeded' ? 'SUCCEEDED' : data.status === 'failed' ? 'FAILED' : 'PENDING'),
          expiresAt: data.expiresAt,
        })
        return
      }

      if (data.status === 'succeeded') {
        showCashView({ method, amountCents: data.amountCents, breakdown: [] })
        setStatus('SUCCEEDED')
      } else if (data.status === 'failed') {
        showCashView({ method, amountCents: data.amountCents, breakdown: [] })
        setCashStatusText(data.errorMessage || 'Mislukt, probeer opnieuw')
      } else {
        showCashView({ method, amountCents: data.amountCents, breakdown: [] })
      }
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
        reset: () => showIdleView(),
      })
    })

    return () => socket?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const channel = new BroadcastChannel('questo-payment')
    channelRef.current = channel

    channel.onmessage = (event) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'payment') {
        if (msg.method === 'cash' || msg.method === 'sumup') showCashView(msg)
        else showQrView(msg)
      } else if (msg.type === 'status') {
        setStatus(msg.status)
      } else if (msg.type === 'reset') {
        showIdleView()
      }
    }

    channel.postMessage({ type: 'request-state' })

    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (viewKind !== 'qr' || !payment.expiresAt) {
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
  }, [viewKind, payment.expiresAt])

  const breakdown = payment.breakdown ?? []

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 text-foreground">
      {viewKind === 'idle' && (
        <>
          <AppBrand className="text-3xl" />
          <p className="max-w-md text-center text-xl text-muted-foreground">Klaar voor de volgende betaling</p>
        </>
      )}

      {viewKind === 'qr' && (
        <>
          <AppBrand className="text-xl" />
          {payment.qrCodeUrl && (
            <img src={payment.qrCodeUrl} alt="QR-code voor betaling" className="size-[min(60vw,420px)]" />
          )}
          {breakdown.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              {breakdown.map((line, i) => (
                <p key={i} className="text-lg text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}
          <p className="font-heading text-4xl font-extrabold">{formatAmount(payment.amountCents)}</p>
          <p className="text-xl font-bold text-muted-foreground uppercase">{STATUS_LABELS[statusCode] || statusCode}</p>
          {countdownText && <p className="text-sm text-muted-foreground">{countdownText}</p>}
        </>
      )}

      {viewKind === 'cash' && (
        <>
          <AppBrand className="text-xl" />
          {breakdown.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              {breakdown.map((line, i) => (
                <p key={i} className="text-lg text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}
          <p className="font-heading text-4xl font-extrabold">{formatAmount(payment.amountCents)}</p>
          <p className="text-xl font-bold text-muted-foreground uppercase">{cashStatusText}</p>
        </>
      )}

      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50"
          onClick={() => channelRef.current?.postMessage({ type: 'reset-requested' })}
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-green-600 px-16 py-12 text-white shadow-2xl">
            <span className="text-8xl leading-none">&#10003;</span>
            <span className="text-5xl font-extrabold tracking-wide">BETAALD</span>
          </div>
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="fixed right-4 bottom-4 opacity-50 hover:opacity-100"
        onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
      >
        Volledig scherm
      </Button>

      <p className="fixed bottom-2 left-2 text-xs text-muted-foreground">
        {terminalHint}
        {linkedHint && ` — ${linkedHint}`}
      </p>
    </div>
  )
}
