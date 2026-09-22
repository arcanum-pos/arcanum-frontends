// Local counterpart of arcanum-webapp's src/lib/slots.ts — purely local
// (never sent anywhere except as an opaque slotId field on every
// transaction/payment payload) time-bucketing for later reporting/filtering
// by shift. Same localStorage key, byte-compatible.
const SLOTS_KEY = 'arcanum-slots'

export interface Slot {
  id: string
  startedAt: string
}

function createSlot(): Slot {
  return { id: String(Date.now()), startedAt: new Date().toISOString() }
}

export function getAllSlots(): Slot[] {
  let slots: Slot[]
  try {
    slots = JSON.parse(localStorage.getItem(SLOTS_KEY) || '[]')
  } catch (err) {
    console.error('Kon tijdvakken niet laden', err)
    slots = []
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    slots = [createSlot()]
    localStorage.setItem(SLOTS_KEY, JSON.stringify(slots))
  }

  return slots
}

export function getCurrentSlot(): Slot {
  const slots = getAllSlots()
  return slots[slots.length - 1]
}

export function getCurrentSlotId(): string {
  return getCurrentSlot().id
}

export function startNewSlot(): Slot {
  const slots = getAllSlots()
  const slot = createSlot()
  slots.push(slot)
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots))
  return slot
}

export function slotLabel(slot: Slot, index: number): string {
  const date = new Date(slot.startedAt).toLocaleString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Tijdvak ${index + 1} (${date})`
}

export const SLOTS_STORAGE_KEY = SLOTS_KEY
