import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { createDevicePairing, listDevicePairings, type DevicePairing, type OrgDevice } from '../lib/api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// Toestellen → "Toestel toevoegen": a pairing code for a new kassa or
// customer display (arcanum-backend devices.ts). The code and its QR are
// shown once; the device enters it on the start page (root `/` — the QR
// opens it with the code filled in). Polls until it's claimed or expired.
// A customer display can be meant for one kassa (`kassas`, by name): it's
// linked to it as soon as it's paired.
const LATER = 'later'

export function AddDeviceDialog({ orgId, kassas, onPaired }: { orgId: string; kassas: OrgDevice[]; onPaired: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES).devices
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'pos' | 'cfd'>('pos')
  const [name, setName] = useState('')
  const [linkTo, setLinkTo] = useState<string>(LATER)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState<(DevicePairing & { code: string }) | null>(null)
  const [status, setStatus] = useState<DevicePairing['status']>('open')
  const [now, setNow] = useState(() => Date.now())

  function reset() {
    setRole('pos')
    setName('')
    setLinkTo(LATER)
    setError(null)
    setPairing(null)
    setStatus('open')
  }

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      setPairing(await createDevicePairing(orgId, role, name.trim(), linkTo === LATER ? null : linkTo))
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
  const url = pairing ? `${window.location.origin}/?code=${encodeURIComponent(pairing.code.replace('-', ''))}` : ''

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
              <Select value={role} onValueChange={(v) => setRole(v as 'pos' | 'cfd')}>
                <SelectTrigger aria-label={m.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos">{m.roles.pos}</SelectItem>
                  <SelectItem value="cfd">{m.roles.cfd}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="device-name">{m.deviceName}</Label>
              <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'pos' ? m.namePlaceholderPos : m.namePlaceholderCfd} autoComplete="off" />
            </div>
            {role === 'cfd' && (
              <div className="grid gap-2">
                <Label>{m.forKassa}</Label>
                <Select value={linkTo} onValueChange={setLinkTo}>
                  <SelectTrigger aria-label={m.forKassa}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LATER}>{m.linkLater}</SelectItem>
                    {kassas.map((k) => (
                      <SelectItem key={k.terminal_id} value={k.terminal_id}>
                        {k.name || k.terminal_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {pairing && shownStatus === 'open' && (
          <div className="flex flex-col items-center gap-3" data-testid="pairing-code">
            <p className="font-mono text-4xl font-bold tracking-widest">{pairing.code}</p>
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={url} size={176} marginSize={0} />
            </div>
            <p className="text-sm text-muted-foreground">{m.expiresIn(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`)}</p>
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
            <Button onClick={create} disabled={busy || !name.trim()}>
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
