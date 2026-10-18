import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMessages } from '@/shared/i18n'
import { createDeviceRepair, type OrgDevice } from '../lib/api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import { PairingClaimed, PairingCode, usePairingStatus, type ShownPairing } from './pairing-code'

// Toestellen → a device → "Opnieuw koppelen" (DOMAIN_MODEL.md "Devices",
// re-pairing): a code that makes a browser this device again — one that lost
// its storage, a new tablet, or the same device as an installed app. It
// stays the same device (name, links, station, history); whichever browser
// was it until now stops being it.
export function RepairDeviceDialog({ orgId, device, onClose, onRepaired }: { orgId: string; device: OrgDevice | null; onClose: () => void; onRepaired: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES).devices
  const [pairing, setPairing] = useState<ShownPairing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { status, secondsLeft } = usePairingStatus(orgId, pairing, onRepaired)

  async function makeCode(terminalId: string) {
    setError(null)
    setPairing(null)
    try {
      setPairing(await createDeviceRepair(orgId, terminalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    if (device) void makeCode(device.terminal_id)
    // A code each time the dialog opens for a device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.terminal_id])

  const name = device?.name || device?.terminal_id || ''
  return (
    <Dialog
      open={!!device}
      onOpenChange={(open) => {
        if (open) return
        setPairing(null)
        onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.repairTitle(name)}</DialogTitle>
          <DialogDescription>{m.repairHint}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {pairing && status === 'open' && <PairingCode pairing={pairing} secondsLeft={secondsLeft} />}
        {pairing && status === 'claimed' && <PairingClaimed text={m.repaired(name)} />}
        {pairing && (status === 'expired' || status === 'revoked') && <p className="text-sm text-muted-foreground">{m.codeExpired}</p>}
        <DialogFooter>
          {device && pairing && status !== 'open' && status !== 'claimed' && <Button onClick={() => makeCode(device.terminal_id)}>{m.newCode}</Button>}
          {pairing && status === 'claimed' && <Button onClick={onClose}>{m.done}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
