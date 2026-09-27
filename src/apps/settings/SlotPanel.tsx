import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { getAllSlots, startNewSlot } from '@/shared/slots'
import { SETTINGS_MESSAGES } from './messages'

// The local tijdvak (shift) of this device — split out of the old pricing
// panel when the platform-wide prices and their password gate were retired
// (step 3d; prices now live on the menukaart). The tijdvak is stored in this
// browser only (src/shared/slots.ts), so a confirm is the only guard; a real
// server-side Shift (DOMAIN_MODEL.md) replaces this later.
export function SlotPanel() {
  const m = useMessages(SETTINGS_MESSAGES)
  const { locale } = useLocale()
  const [slots, setSlots] = useState(getAllSlots)
  const [started, setStarted] = useState(false)
  const current = slots[slots.length - 1]
  const startedAt = new Date(current.startedAt).toLocaleString(INTL_LOCALES[locale], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  function handleResetSlot() {
    setStarted(false)
    if (!confirm(m.confirmNewSlot)) return
    startNewSlot()
    setSlots(getAllSlots())
    setStarted(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{m.activeSlot(m.slot(slots.length, startedAt))}</p>
      <Button type="button" variant="outline" className="w-fit" onClick={handleResetSlot}>
        {m.startNewSlot}
      </Button>
      {started && <p className="text-sm text-green-600 dark:text-green-500">{m.newSlotStarted}</p>}
    </div>
  )
}
