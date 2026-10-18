import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { createDevicePairing, type OrgDevice } from '../lib/api'
import { listStations, type Station } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import { PairingClaimed, PairingCode, usePairingStatus, type ShownPairing } from './pairing-code'

// Toestellen → "Toestel toevoegen": a pairing code for a new kassa or
// customer display (arcanum-backend devices.ts). The code and its QR are
// shown once; the device enters it on the start page (root `/` — the QR
// opens it with the code filled in). Polls until it's claimed or expired.
// A customer display can be meant for one kassa (`kassas`, by name): it's
// linked to it as soon as it's paired. A Tap to Pay phone always is, and
// its QR opens the phone's own page (/tap), where it's paired.
// The code itself, its QR and link: PairingCode.
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
  const [pairing, setPairing] = useState<ShownPairing | null>(null)
  const { status: shownStatus, secondsLeft } = usePairingStatus(orgId, pairing, onPaired)

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
  }

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const view = role === 'pickup' ? 'pickup' : role === 'entrance' ? 'tables' : null
      setPairing(await createDevicePairing(orgId, view ? 'station' : (role as 'pos' | 'cfd' | 'station' | 'tap'), name.trim(), linkTo === LATER ? null : linkTo, role === 'entrance' ? null : stationId || null, view))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

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

        {pairing && shownStatus === 'open' && <PairingCode pairing={pairing} secondsLeft={secondsLeft} />}
        {pairing && shownStatus === 'claimed' && (
          <PairingClaimed text={pairing.linkTo ? m.pairedDisplayFor(pairing.name, kassas.find((k) => k.terminal_id === pairing.linkTo)?.name || pairing.linkTo) : m.pairedDevice(pairing.name)} />
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

