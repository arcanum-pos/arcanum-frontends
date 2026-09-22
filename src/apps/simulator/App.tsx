import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KioskShell } from '@/shared/kiosk-shell'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'

// Simulates a SumUp Solo device for local testing (no reader hardware
// required). Registers as role 'sim', gets linked to a POS from Settings
// just like a CFD, and reacts to the same notification events. Confirming
// reuses the existing /sumup/confirm endpoint — the same one the cashier's
// manual "confirm" button calls — so the worker/DO side needs no
// simulator-specific code at all.
const WORKER_URL = '/api/bancontact'

type View = { step: 'idle' } | { step: 'payment'; chargeId: string; amountCents: number; status: string }

export default function App() {
  const [view, setView] = useState<View>({ step: 'idle' })
  const [linkedHint, setLinkedHint] = useState('')
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

      setLinkedHint(`SIM-ID: ${terminal.terminalId}`)

      socket = connectNotifications(terminal.terminalId, {
        linked: (msg) => setLinkedHint(`SIM-ID: ${terminal.terminalId} — gekoppeld aan kassa ${msg.pos_terminal_id}`),
        unlinked: () => {
          setLinkedHint(`SIM-ID: ${terminal.terminalId} — niet gekoppeld aan een kassa`)
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

  return (
    <KioskShell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">SumUp-simulator</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {view.step === 'idle' && <p className="text-muted-foreground">Wacht op betaalverzoek</p>}

          {view.step === 'payment' && (
            <>
              <p className="font-heading text-4xl font-extrabold">
                {Number.isInteger(view.amountCents) ? `€ ${(view.amountCents / 100).toFixed(2).replace('.', ',')}` : ''}
              </p>
              <Badge variant={view.status === 'succeeded' ? 'default' : 'secondary'} className="text-sm uppercase">
                {view.status === 'succeeded' ? 'Betaald' : 'In afwachting'}
              </Badge>
              {view.status !== 'succeeded' && (
                <Button onClick={confirmPaid} disabled={confirming}>
                  Betaald
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
