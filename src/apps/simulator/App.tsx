import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { KioskShell } from '@/shared/kiosk-shell'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { SIMULATOR_MESSAGES } from './messages'

// Simulates a SumUp Solo device for local testing (no reader hardware
// required). Registers as role 'sim', gets linked to a POS from Settings
// just like a CFD, and reacts to the same notification events. Confirming
// reuses the existing /sumup/confirm endpoint — the same one the cashier's
// manual "confirm" button calls — so the worker/DO side needs no
// simulator-specific code at all.
const WORKER_URL = '/api/bancontact'

type View = { step: 'idle' } | { step: 'payment'; chargeId: string; amountCents: number; status: string }

// What the corner hint says — kept as data, worded at render time so it
// follows a language switch.
type Link = { terminalId: string; state: 'unknown' } | { terminalId: string; state: 'linked'; pos: string } | { terminalId: string; state: 'unlinked' }

export default function App() {
  const m = useMessages(SIMULATOR_MESSAGES)
  const [view, setView] = useState<View>({ step: 'idle' })
  const [link, setLink] = useState<Link | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let socket: ReturnType<typeof connectNotifications> | null = null

    async function fetchAndShowCharge(paymentId: string) {
      try {
        const res = await fetch(`${WORKER_URL}/sumup/status/${encodeURIComponent(paymentId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'succeeded' || data.status === 'failed') {
          setView({ step: 'idle' })
          return
        }
        setView({ step: 'payment', chargeId: paymentId, amountCents: data.amountCents, status: data.status })
      } catch (err) {
        console.error('Kon betaalverzoek niet ophalen', err)
      }
    }

    getRegisteredTerminal('sim').then((terminal) => {
      if (!terminal) {
        window.location.replace('/')
        return
      }

      const terminalId = terminal.terminalId
      setLink({ terminalId, state: 'unknown' })

      socket = connectNotifications(terminalId, {
        linked: (msg) => setLink({ terminalId, state: 'linked', pos: msg.pos_terminal_id }),
        unlinked: () => {
          setLink({ terminalId, state: 'unlinked' })
          setView({ step: 'idle' })
        },
        payment_updated: (msg) => fetchAndShowCharge(msg.payment_id),
      })
    })

    return () => socket?.close()
  }, [])

  async function confirmPaid() {
    if (view.step !== 'payment') return
    setConfirming(true)
    try {
      await fetch(`${WORKER_URL}/sumup/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId: view.chargeId, success: true }),
      })
      setView({ ...view, status: 'succeeded' })
    } catch (err) {
      console.error('Kon betaling niet bevestigen', err)
    } finally {
      setConfirming(false)
    }
  }

  const linkedHint = !link
    ? ''
    : link.state === 'linked'
      ? m.linked(link.terminalId, link.pos)
      : link.state === 'unlinked'
        ? m.unlinked(link.terminalId)
        : m.simId(link.terminalId)

  return (
    <KioskShell languagePicker>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">{m.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {view.step === 'idle' && <p className="text-muted-foreground">{m.waiting}</p>}

          {view.step === 'payment' && (
            <>
              <p className="font-heading text-4xl font-extrabold">
                {Number.isInteger(view.amountCents) ? `€ ${(view.amountCents / 100).toFixed(2).replace('.', ',')}` : ''}
              </p>
              <Badge variant={view.status === 'succeeded' ? 'default' : 'secondary'} className="text-sm uppercase">
                {view.status === 'succeeded' ? m.paid : m.pending}
              </Badge>
              {view.status !== 'succeeded' && (
                <Button onClick={confirmPaid} disabled={confirming}>
                  {m.confirmPaid}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="fixed bottom-2 left-2 text-xs text-muted-foreground">{linkedHint}</p>
    </KioskShell>
  )
}
