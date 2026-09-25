import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getAllSlots, slotLabel, startNewSlot } from '@/shared/slots'

function currentLabel() {
  const slots = getAllSlots()
  return `Actief tijdvak: ${slotLabel(slots[slots.length - 1], slots.length - 1)}`
}

// The local tijdvak (shift) of this device — split out of the old pricing
// panel when the platform-wide prices and their password gate were retired
// (step 3d; prices now live on the menukaart). The tijdvak is stored in this
// browser only (src/shared/slots.ts), so a confirm is the only guard; a real
// server-side Shift (DOMAIN_MODEL.md) replaces this later.
export function SlotPanel() {
  const [label, setLabel] = useState(currentLabel)
  const [message, setMessage] = useState('')

  function handleResetSlot() {
    setMessage('')
    if (!confirm('Nieuw tijdvak starten? Bestaande transacties blijven bewaard onder het huidige tijdvak.')) return
    startNewSlot()
    setLabel(currentLabel())
    setMessage('Nieuw tijdvak gestart.')
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button type="button" variant="outline" className="w-fit" onClick={handleResetSlot}>
        Nieuw tijdvak starten
      </Button>
      {message && <p className="text-sm text-green-600 dark:text-green-500">{message}</p>}
    </div>
  )
}
