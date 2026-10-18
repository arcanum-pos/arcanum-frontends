import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { appStorage } from '@/shared/install'
import { createDevicePairing, listDevicePairings, type DevicePairing, type OrgDevice } from '../lib/api'
import { listStations, type Station } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// Toestellen → "Toestel toevoegen": a pairing code for a new kassa or
// customer display (arcanum-backend devices.ts). The code and its QR are
// shown once; the device enters it on the start page (root `/` — the QR
// opens it with the code filled in). Polls until it's claimed or expired.
// A customer display can be meant for one kassa (`kassas`, by name): it's
// linked to it as soon as it's paired. A Tap to Pay phone always is, and
// its QR opens the phone's own page (/tap), where it's paired.
// The link carries the device's role and name: the pairing page shows that
// device's icon and name, so an app added from it (Safari: install first,
// then pair — shared/install) is that device. Several devices on one
// computer: each its own app in Safari's Dock (its own storage) — so "Open op
// deze computer" only where the console itself runs in Safari on a Mac; in
// another browser on a Mac, the advice to paste the link into Safari.
const LATER = 'later'

export function AddDeviceDialog({ orgId, kassas, onPaired }: { orgId: string; kassas: OrgDevice[]; onPaired: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES).devices
  const [open, setOpen] = useState(false)
  // 'pickup': a station screen for guests (role 'station', view 'pickup').
  // 'entrance': the entrance screen (role 'station', view 'tables', no station — release D).
  // 'tap': a kassa's Tap to Pay phone (always for one kassa).
  const [role, setRole] = useState<'pos' | 'cfd' | 'station' | 'pickup' | 'entrance' | 'tap'>('pos')
  const forStation = role === 'station' || role === 'pickup'
  // A station screen shows one prep station.
  const [stations, setStations] = useState<Station[] | null>(null)
  const [stationId, setStationId] = useState<string>('')
  const [name, setName] = useState('')
  const [linkTo, setLinkTo] = useState<string>(LATER)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState<(DevicePairing & { code: string }) | null>(null)
  const [status, setStatus] = useState<DevicePairing['status']>('open')
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!forStation || stations) return
    listStations(orgId)
      .then((list) => {
        setStations(list)
        if (list[0]) setStationId((current) => current || list[0].id)
      })
      .catch(() => setStations([]))
  }, [forStation, stations, orgId])

  function reset() {
    setRole('pos')
    setStationId('')
    setName('')
    setLinkTo(LATER)
    setError(null)
    setPairing(null)
    setStatus('open')
    setCopied(false)
  }

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const view = role === 'pickup' ? 'pickup' : role === 'entrance' ? 'tables' : null
      setPairing(await createDevicePairing(orgId, view ? 'station' : (role as 'pos' | 'cfd' | 'station' | 'tap'), name.trim(), linkTo === LATER ? null : linkTo, role === 'entrance' ? null : stationId || null, view))
      setStatus('open')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // While the code is open: tick the countdown, and see whether it's been claimed.
  useEffect(() => {
    if (!pairing || status !== 'open') return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => {
      listDevicePairings(orgId)
        .then((list) => {
          const current = list.find((p) => p.id === pairing.id)
          if (current && current.status !== 'open') {
            setStatus(current.status)
            if (current.status === 'claimed') onPaired()
          }
        })
        .catch(() => {})
    }, 3000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [orgId, pairing, status, onPaired])

  const secondsLeft = pairing ? Math.max(0, Math.round((Date.parse(pairing.expiresAt) - now) / 1000)) : 0
  const shownStatus = status === 'open' && pairing && secondsLeft === 0 ? 'expired' : status
  const url = pairing ? pairingUrl(pairing) : ''

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {m.addDevice}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.addDevice}</DialogTitle>
          <DialogDescription>{pairing ? m.codeHint(window.location.host) : m.addDeviceHint}</DialogDescription>
        </DialogHeader>

        {!pairing && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{m.type}</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as 'pos' | 'cfd' | 'station' | 'pickup' | 'entrance' | 'tap')
                  // A Tap to Pay phone is always for a kassa: the first one, to start with.
                  if (v === 'tap' && linkTo === LATER && kassas[0]) setLinkTo(kassas[0].terminal_id)
                }}
              >
                <SelectTrigger aria-label={m.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos">{m.roles.pos}</SelectItem>
                  <SelectItem value="cfd">{m.roles.cfd}</SelectItem>
                  <SelectItem value="station">{m.roles.station}</SelectItem>
                  <SelectItem value="pickup">{m.pickupScreen}</SelectItem>
                  <SelectItem value="entrance">{m.entranceScreen}</SelectItem>
                  <SelectItem value="tap">{m.roles.tap}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="device-name">{m.deviceName}</Label>
              <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'pos' ? m.namePlaceholderPos : role === 'station' ? m.namePlaceholderStation : role === 'pickup' ? m.namePlaceholderPickup : role === 'entrance' ? m.namePlaceholderEntrance : role === 'tap' ? m.namePlaceholderTap : m.namePlaceholderCfd} autoComplete="off" />
            </div>
            {(role === 'cfd' || role === 'tap') && (
              <div className="grid gap-2">
                <Label>{m.forKassa}</Label>
                <Select value={linkTo} onValueChange={setLinkTo}>
                  <SelectTrigger aria-label={m.forKassa}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {role === 'cfd' && <SelectItem value={LATER}>{m.linkLater}</SelectItem>}
                    {kassas.map((k) => (
                      <SelectItem key={k.terminal_id} value={k.terminal_id}>
                        {k.name || k.terminal_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {role === 'entrance' && <p className="text-xs text-muted-foreground">{m.entranceHint}</p>}
            {role === 'tap' && <p className="text-xs text-muted-foreground">{kassas.length ? m.tapHint : m.tapNeedsKassa}</p>}
            {forStation && (
              <div className="grid gap-2">
                <Label>{m.station}</Label>
                {stations && stations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{m.noStations}</p>
                ) : (
                  <Select value={stationId} onValueChange={setStationId}>
                    <SelectTrigger aria-label={m.station}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(stations ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">{role === 'pickup' ? m.pickupHint : m.stationHint}</p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {pairing && shownStatus === 'open' && (
          <div className="flex flex-col items-center gap-3" data-testid="pairing-code">
            <p className="font-mono text-4xl font-bold tracking-widest">{pairing.code}</p>
            <div className="rounded-lg bg-white p-3" data-testid="pairing-qr">
              <QRCodeSVG value={url} size={176} marginSize={0} />
            </div>
            <p className="text-sm text-muted-foreground">{m.expiresIn(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`)}</p>
            {pairing.role !== 'tap' && (
              <>
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
                  {appStorage() === 'mac' && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noopener">
                        <ExternalLink />
                        {m.openHere}
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground">{m.asAppHint}</p>
                {appStorage() === 'shared' && /Macintosh/.test(navigator.userAgent) && <p className="text-center text-xs text-muted-foreground">{m.thisMacHint}</p>}
              </>
            )}
          </div>
        )}
        {pairing && shownStatus === 'claimed' && (
          <p className="flex items-center gap-2 text-sm font-medium" data-testid="pairing-claimed">
            <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
            {pairing.linkTo ? m.pairedDisplayFor(pairing.name, kassas.find((k) => k.terminal_id === pairing.linkTo)?.name || pairing.linkTo) : m.pairedDevice(pairing.name)}
          </p>
        )}
        {pairing && (shownStatus === 'expired' || shownStatus === 'revoked') && <p className="text-sm text-muted-foreground">{m.codeExpired}</p>}

        <DialogFooter>
          {!pairing && (
            <Button onClick={create} disabled={busy || !name.trim() || (forStation && !stationId) || (role === 'tap' && linkTo === LATER)}>
              {busy ? m.busy : m.makeCode}
            </Button>
          )}
          {pairing && shownStatus !== 'open' && shownStatus !== 'claimed' && <Button onClick={() => setPairing(null)}>{m.newCode}</Button>}
          {pairing && shownStatus === 'claimed' && (
            <Button
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              {m.done}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// What the QR and the link open: /pair with the code, and the device's role
// and name; a Tap to Pay phone its own page (/tap).
function pairingUrl(pairing: DevicePairing & { code: string }): string {
  const code = pairing.code.replace('-', '')
  if (pairing.role === 'tap') return `${window.location.origin}/tap?code=${encodeURIComponent(code)}`
  return `${window.location.origin}/pair?${new URLSearchParams({ code, role: pairing.role, name: pairing.name })}`
}
