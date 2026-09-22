import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppBrand } from '@/shared/app-brand'
import { OrgBadge } from '@/shared/org-badge'
import { getDeviceId, getDeviceName, getSumupReader } from '@/shared/device'
import {
  connectNotifications,
  getLinkedDevice,
  getRegisteredTerminal,
  linkTerminals,
  registerRemoteTerminal,
  unlinkTerminal,
} from '@/shared/terminal'
import { getCurrentSlotId } from '@/shared/slots'
import { buildBreakdownLines, DEFAULT_PRICING, MANUAL_METHOD_LABELS, type CurrentPayment, type OrderItems, type PaymentMethod, type Pricing } from './lib'
import { OrderBuilder } from './OrderBuilder'
import { PaymentStatus } from './PaymentStatus'

const WORKER_URL = '/api/bancontact'
const DEVICES_URL = '/api/devices'

export default function App() {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bancontact')
  const [current, setCurrent] = useState<CurrentPayment | null>(null)
  const [manualStatusText, setManualStatusText] = useState('')
  const [countdownText, setCountdownText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [builderKey, setBuilderKey] = useState(0)
  const [terminalIdLabel, setTerminalIdLabel] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [openingDisplay, setOpeningDisplay] = useState(false)

  const currentRef = useRef<CurrentPayment | null>(null)
  const posTerminalIdRef = useRef<string | null>(null)
  const posOrgIdRef = useRef<string | null>(null)
  const userNameRef = useRef('')
  const userEmailRef = useRef('')
  const channelRef = useRef<BroadcastChannel | null>(null)
  const displayWindowRef = useRef<Window | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pricingRef = useRef(pricing)
  pricingRef.current = pricing

  function setCurrentBoth(value: CurrentPayment | null) {
    currentRef.current = value
    setCurrent(value)
  }

  function broadcastCurrent() {
    const c = currentRef.current
    channelRef.current?.postMessage(c ? { type: 'payment', ...c } : { type: 'reset' })
  }

  function stopCountdown() {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = null
    setCountdownText('')
  }

  function startCountdown(expiresAt: string) {
    stopCountdown()
    const expiryTime = new Date(expiresAt).getTime()
    countdownTimerRef.current = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((expiryTime - Date.now()) / 1000))
      setCountdownText(secondsLeft > 0 ? `Vervalt over ${secondsLeft}s` : 'Verlopen')
      if (secondsLeft <= 0 && countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }, 1000)
  }

  function reset() {
    stopCountdown()
    setCurrentBoth(null)
    setManualStatusText('')
    setError('')
    setBusy(false)
    setBuilderKey((k) => k + 1)
    broadcastCurrent()

    if (posTerminalIdRef.current) {
      fetch(`${DEVICES_URL}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_terminal_id: posTerminalIdRef.current }),
      }).catch((err) => console.error('Kon klantscherm niet resetten', err))
    }
  }

  async function recordSucceededTransaction(amountCents: number, description: string | undefined, method: string, items: OrderItems | undefined) {
    if (!posOrgIdRef.current) {
      console.error('Kon transactie niet opslaan: organisatie van dit toestel nog niet bekend')
      return
    }
    try {
      const res = await fetch(`${WORKER_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          description: description || '',
          method: method || 'bancontact',
          items: items || {},
          slotId: getCurrentSlotId(),
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
          userName: userNameRef.current,
          userEmail: userEmailRef.current,
          orgId: posOrgIdRef.current,
          completedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
    } catch (err) {
      console.error('Kon transactie niet opslaan', err)
    }
  }

  async function checkBancontactStatus(chargeId: string) {
    const cur = currentRef.current
    if (!cur || cur.method !== 'bancontact' || cur.chargeId !== chargeId) return

    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${chargeId}`)
      const data = await res.json()
      if (!res.ok) return

      // providerStatus carries Bancontact's own rich vocabulary
      // (IDENTIFIED/AUTHORIZED/...) for display; data.status is the
      // collapsed pending/succeeded/failed the backend actually acts on.
      const displayStatus = data.providerStatus || (data.status === 'succeeded' ? 'SUCCEEDED' : data.status === 'failed' ? 'FAILED' : 'PENDING')
      setCurrentBoth({ ...cur, status: displayStatus })
      // No recordSucceededTransaction here — the backend already recorded
      // the sale when it resolved this charge.
      channelRef.current?.postMessage({ type: 'status', status: displayStatus })

      if (data.status === 'succeeded' || data.status === 'failed') stopCountdown()
    } catch (err) {
      console.error('Kon Bancontact status niet ophalen', err)
    }
  }

  // Cash and SumUp are both "manual confirm" flows for now: the cashier
  // collects payment outside the app and just confirms here so it's
  // recorded under the right method for reconciliation.
  async function createTrackedCharge(
    amountCents: number,
    description: string | undefined,
    method: string,
    items: OrderItems | undefined
  ): Promise<string | null> {
    if (!posOrgIdRef.current) {
      console.error('Kon betaling niet registreren: organisatie van dit toestel nog niet bekend')
      return null
    }
    try {
      const res = await fetch(`${WORKER_URL}/sumup/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          description: description || undefined,
          method,
          posTerminalId: posTerminalIdRef.current || undefined,
          items: items || {},
          slotId: getCurrentSlotId(),
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
          orgId: posOrgIdRef.current,
          readerId: method === 'sumup' ? getSumupReader()?.id : undefined,
        }),
      })
      const data = await res.json()
      return res.ok ? data.chargeId || null : null
    } catch (err) {
      console.error('Kon betaling niet registreren voor kassascherm-melding', err)
      return null
    }
  }

  async function confirmTrackedCharge(chargeId: string | null | undefined) {
    if (!chargeId) return
    try {
      await fetch(`${WORKER_URL}/sumup/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId, success: true }),
      })
    } catch (err) {
      console.error('Kon kassascherm niet melden', err)
    }
  }

  function startManualPayment(amountCents: number, description: string, items: OrderItems, method: 'cash' | 'sumup') {
    setError('')
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      setError('Voer een geldig bedrag groter dan 0 in.')
      return
    }

    const payment: CurrentPayment = {
      method,
      status: 'AWAITING_MANUAL',
      amountCents,
      description,
      items,
      breakdown: buildBreakdownLines(items || {}, pricingRef.current),
    }
    setCurrentBoth(payment)
    setManualStatusText(MANUAL_METHOD_LABELS[method].waiting)
    broadcastCurrent()

    // 'sumup' creates its own tracked charge in startSumupPayment (it also
    // checks it); cash has no other server-side record, so create one here.
    if (method === 'cash') {
      createTrackedCharge(amountCents, description, method, items).then((chargeId) => {
        if (currentRef.current && currentRef.current.method === method) {
          setCurrentBoth({ ...currentRef.current, chargeId })
        }
      })
    }
  }

  function confirmManualPayment() {
    // Guards against the SumUp poll and this manual tap both trying to
    // complete the same transaction.
    const cur = currentRef.current
    if (!cur || (cur.method !== 'cash' && cur.method !== 'sumup') || cur.status === 'RESOLVED') return
    stopCountdown()
    setCurrentBoth({ ...cur, status: 'RESOLVED' })
    setManualStatusText(MANUAL_METHOD_LABELS[cur.method].paid)
    channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })

    if (cur.chargeId) {
      // Backend records the sale once it resolves the charge.
      confirmTrackedCharge(cur.chargeId)
    } else {
      // No server-side charge exists yet — record here so the sale isn't
      // silently lost.
      recordSucceededTransaction(cur.amountCents, cur.description, cur.method, cur.items)
    }
  }

  // SumUp gets the manual "confirm" flow above (fallback for using the
  // standalone SumUp app + reader directly) PLUS a push-driven check: the
  // notification socket tells this POS the moment the reader/simulator
  // resolves it — no polling.
  async function startSumupPayment(amountCents: number, description: string, items: OrderItems) {
    startManualPayment(amountCents, description, items, 'sumup')
    if (!currentRef.current || currentRef.current.method !== 'sumup') return // rejected an invalid amount

    const chargeId = await createTrackedCharge(amountCents, description, 'sumup', items)
    if (!chargeId) return // manual confirm is still available as fallback
    if (currentRef.current && currentRef.current.method === 'sumup') {
      setCurrentBoth({ ...currentRef.current, chargeId })
    }
    checkSumupStatus(chargeId) // one immediate check, in case it resolves before the socket delivers
  }

  async function checkSumupStatus(chargeId: string) {
    const cur = currentRef.current
    if (!cur || cur.method !== 'sumup' || cur.chargeId !== chargeId || cur.status === 'RESOLVED') return

    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${chargeId}`)
      const data = await res.json()
      if (!res.ok) return

      if (data.status === 'succeeded') {
        // No recordSucceededTransaction here — the backend already recorded
        // the sale when it resolved this charge.
        setCurrentBoth({ ...cur, status: 'RESOLVED' })
        setManualStatusText(MANUAL_METHOD_LABELS.sumup.paid)
        channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })
      } else if (data.status === 'failed') {
        setManualStatusText(
          data.errorMessage ? `SumUp betaling mislukt: ${data.errorMessage}` : 'SumUp betaling mislukt. Probeer opnieuw of bevestig handmatig.'
        )
      }
    } catch (err) {
      console.error('Kon SumUp status niet ophalen', err)
    }
  }

  // Bancontact used to be polled directly by this browser every 2s — now
  // it's backend-tracked exactly like SumUp: the notification socket pushes
  // the moment a callback or the ChargePoller DO's fallback sweep resolves
  // it. checkBancontactStatus is the same "one immediate check + react to
  // the push" pattern checkSumupStatus uses.
  async function generatePayment(amountCents: number, description: string, items: OrderItems) {
    setError('')
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      setError('Voer een geldig bedrag groter dan 0 in.')
      return
    }
    if (!posOrgIdRef.current) {
      setError('Organisatie van dit toestel nog niet bekend.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`${WORKER_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          description: description || undefined,
          orgId: posOrgIdRef.current,
          posTerminalId: posTerminalIdRef.current || undefined,
          items: items || {},
          slotId: getCurrentSlotId(),
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ? `${data.error}: ${JSON.stringify(data.details)}` : 'Onbekende fout')

      const payment: CurrentPayment = {
        method: 'bancontact',
        chargeId: data.chargeId,
        qrCodeUrl: data.qrCodeUrl,
        expiresAt: data.expiresAt,
        status: data.status,
        amountCents: data.amount,
        description,
        items,
        breakdown: buildBreakdownLines(items || {}, pricingRef.current),
      }
      setCurrentBoth(payment)
      broadcastCurrent()
      startCountdown(data.expiresAt)
      checkBancontactStatus(data.chargeId) // one immediate check, in case it resolves before the push arrives
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startTransaction(amountCents: number, description: string, items: OrderItems) {
    if (paymentMethod === 'bancontact') generatePayment(amountCents, description, items)
    else if (paymentMethod === 'sumup') startSumupPayment(amountCents, description, items)
    else startManualPayment(amountCents, description, items, 'cash')
  }

  async function openDisplay() {
    if (displayWindowRef.current && !displayWindowRef.current.closed) {
      displayWindowRef.current.focus()
      return
    }
    if (!posTerminalIdRef.current || !posOrgIdRef.current) {
      setError('Wacht tot dit toestel geregistreerd is voor u een klantscherm opent.')
      return
    }

    setOpeningDisplay(true)
    try {
      const existingCfd = await getLinkedDevice(posTerminalIdRef.current, 'cfd')
      if (existingCfd?.terminal_id) {
        await unlinkTerminal(existingCfd.terminal_id)
      }

      const cfdTerminalId = await registerRemoteTerminal('cfd', posOrgIdRef.current)
      await linkTerminals(posTerminalIdRef.current, cfdTerminalId)

      let features = 'width=1024,height=768'
      const getScreenDetails = (window as any).getScreenDetails
      if (typeof getScreenDetails === 'function') {
        try {
          const details = await getScreenDetails()
          const other = details.screens.find((s: any) => s !== details.currentScreen)
          if (other) {
            features = `left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`
          }
        } catch (err) {
          console.warn('Kon schermdetails niet ophalen, klantscherm wordt normaal geopend.', err)
        }
      }

      displayWindowRef.current = window.open(`/display.html?terminal=${encodeURIComponent(cfdTerminalId)}`, 'arcanum-display', features)
    } catch (err) {
      console.error('Kon klantscherm niet koppelen/openen', err)
      setError('Kon klantscherm niet openen.')
    } finally {
      setOpeningDisplay(false)
    }
  }

  useEffect(() => {
    fetch(`${WORKER_URL}/settings`)
      .then((res) => res.json())
      .then((data) => {
        setPricing((prev) => ({
          amountPerBonCents: Number.isInteger(data.amountPerBonCents) && data.amountPerBonCents > 0 ? data.amountPerBonCents : prev.amountPerBonCents,
          fietstochtMemberCents:
            Number.isInteger(data.fietstochtMemberCents) && data.fietstochtMemberCents > 0 ? data.fietstochtMemberCents : prev.fietstochtMemberCents,
          fietstochtNonMemberCents:
            Number.isInteger(data.fietstochtNonMemberCents) && data.fietstochtNonMemberCents > 0
              ? data.fietstochtNonMemberCents
              : prev.fietstochtNonMemberCents,
          wandeltochtMemberCents:
            Number.isInteger(data.wandeltochtMemberCents) && data.wandeltochtMemberCents > 0
              ? data.wandeltochtMemberCents
              : prev.wandeltochtMemberCents,
          wandeltochtNonMemberCents:
            Number.isInteger(data.wandeltochtNonMemberCents) && data.wandeltochtNonMemberCents > 0
              ? data.wandeltochtNonMemberCents
              : prev.wandeltochtNonMemberCents,
        }))
      })
      .catch((err) => console.error('Kon prijsinstellingen niet laden, gebruik standaardwaarden.', err))
  }, [])

  useEffect(() => {
    fetch('/whoami')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        userNameRef.current = data.name || ''
        userEmailRef.current = data.email || ''
        setUserLabel(`Ingelogd als ${data.name || data.email}`)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let socket: ReturnType<typeof connectNotifications> | null = null

    getRegisteredTerminal('pos').then((terminal) => {
      if (!terminal) {
        // Never went through the chooser (e.g. a bookmarked/direct URL) —
        // send them there to pick an organization + role properly.
        window.location.replace('/')
        return
      }

      posTerminalIdRef.current = terminal.terminalId
      posOrgIdRef.current = terminal.orgId
      setTerminalIdLabel(`POS-ID: ${terminal.terminalId}`)

      // Replaces polling: the notification socket pushes payment_updated
      // the moment a linked reader/simulator resolves a charge this POS
      // created.
      socket = connectNotifications(terminal.terminalId, {
        payment_updated: (msg) => {
          if (msg.method === 'sumup') checkSumupStatus(msg.payment_id)
          else if (msg.method === 'bancontact') checkBancontactStatus(msg.payment_id)
        },
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
      if (msg.type === 'request-state') broadcastCurrent()
      else if (msg.type === 'reset-requested') reset()
    }
    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showConfirmButton = current !== null && current.status !== 'RESOLVED'

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <OrgBadge />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <AppBrand className="text-xl" />
          <div className="text-sm text-muted-foreground">
            <p>{getDeviceName()}</p>
            <p>{terminalIdLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{userLabel}</span>
          <Button variant="outline" size="sm" disabled={openingDisplay} onClick={openDisplay}>
            Klantscherm openen
          </Button>
          <a href="/settings.html" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Instellingen
          </a>
          <a href="/logout" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Uitloggen
          </a>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {!current && (
        <OrderBuilder
          key={builderKey}
          pricing={pricing}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          onGenerate={startTransaction}
          onError={setError}
          busy={busy}
        />
      )}

      {current && (
        <PaymentStatus
          current={current}
          manualStatusText={manualStatusText}
          countdownText={countdownText}
          showConfirmButton={showConfirmButton}
          onConfirm={confirmManualPayment}
          onCancel={reset}
        />
      )}
    </div>
  )
}
