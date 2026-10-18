import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/shared/i18n'
import { appStorage, iconSlot, orgIconRef } from '@/shared/install'
import { listDevicePairings, type DevicePairing } from '../lib/api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// A pairing code as the console shows it — for a new device (Toestel
// toevoegen) and for an existing one (Opnieuw koppelen): the code, its QR,
// how long it's valid, and the link. The link carries the device's role and
// name: the pairing page shows that device's icon and name, so an app added
// from it (Safari: install first, then pair — shared/install) is that
// device. Several devices on one computer: each its own app in Safari's Dock
// (its own storage) — so "Open op deze computer" only where the console
// itself runs in Safari on a Mac; in another browser on a Mac, the advice to
// paste the link into Safari.

export type ShownPairing = DevicePairing & { code: string }

// While the code is open: the countdown, and whether it's been claimed (polled).
export function usePairingStatus(orgId: string, pairing: ShownPairing | null, onClaimed: () => void) {
  const [state, setState] = useState<{ id: string | null; status: DevicePairing['status'] }>({ id: null, status: 'open' })
  const [now, setNow] = useState(() => Date.now())
  const status = pairing && state.id === pairing.id ? state.status : 'open'

  useEffect(() => {
    if (!pairing || status !== 'open') return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => {
      listDevicePairings(orgId)
        .then((list) => {
          const current = list.find((p) => p.id === pairing.id)
          if (current && current.status !== 'open') {
            setState({ id: pairing.id, status: current.status })
            if (current.status === 'claimed') onClaimed()
          }
        })
        .catch(() => {})
    }, 3000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [orgId, pairing, status, onClaimed])

  const secondsLeft = pairing ? Math.max(0, Math.round((Date.parse(pairing.expiresAt) - now) / 1000)) : 0
  return { status: status === 'open' && pairing && secondsLeft === 0 ? 'expired' : status, secondsLeft }
}

// What the QR and the link open: /pair with the code, the device's role and
// name, and which of the organisation's icons it gets (Weergave → App-iconen);
// a Tap to Pay phone its own page (/tap).
function pairingUrl(orgId: string, pairing: ShownPairing): string {
  const code = pairing.code.replace('-', '')
  const icon = orgIconRef(orgId, iconSlot(pairing.role, pairing))
  if (pairing.role === 'tap') return `${window.location.origin}/tap?${new URLSearchParams({ code, icon })}`
  return `${window.location.origin}/pair?${new URLSearchParams({ code, role: pairing.role, name: pairing.name, icon })}`
}

export function PairingCode({ orgId, pairing, secondsLeft }: { orgId: string; pairing: ShownPairing; secondsLeft: number }) {
  const m = useMessages(ADMIN_ORG_MESSAGES).devices
  const [copied, setCopied] = useState(false)
  const url = pairingUrl(orgId, pairing)
  return (
    <div className="flex flex-col items-center gap-3" data-testid="pairing-code">
      <p className="font-mono text-4xl font-bold tracking-widest">{pairing.code}</p>
      <div className="rounded-lg bg-white p-3" data-testid="pairing-qr">
        <QRCodeSVG value={url} size={176} marginSize={0} />
      </div>
      <p className="text-sm text-muted-foreground">{m.expiresIn(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`)}</p>
      {/* Kopieer link for every device (a Tap to Pay phone too: its own page,
          by message instead of the QR); the app advice only for the pairing
          page's devices — a Tap to Pay phone pairs on /tap itself. */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => {})
            setCopied(true)
          }}
        >
          <Copy />
          {copied ? m.linkCopied : m.copyLink}
        </Button>
        {pairing.role !== 'tap' && appStorage() === 'mac' && (
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener">
              <ExternalLink />
              {m.openHere}
            </a>
          </Button>
        )}
      </div>
      {pairing.role !== 'tap' && (
        <>
          <p className="text-center text-xs text-muted-foreground">{m.asAppHint}</p>
          {appStorage() === 'shared' && /Macintosh/.test(navigator.userAgent) && <p className="text-center text-xs text-muted-foreground">{m.thisMacHint}</p>}
        </>
      )}
    </div>
  )
}

export function PairingClaimed({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium" data-testid="pairing-claimed">
      <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
      {text}
    </p>
  )
}
