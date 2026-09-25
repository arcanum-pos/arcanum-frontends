// Local counterpart of arcanum-webapp's src/lib/device.ts — per-browser
// id/name used for transaction attribution ("which physical till made this
// sale"), distinct from terminal.ts's role-based POS/CFD/sim identity. Same
// localStorage keys, byte-compatible.
const DEVICE_KEY = 'arcanum-device'

export interface Device {
  id: string
  name: string
}

function generateDeviceId(): string {
  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getDevice(): Device {
  let device: Device | null
  try {
    device = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null')
  } catch (err) {
    console.error('Kon toestel niet laden', err)
    device = null
  }

  if (!device || !device.id) {
    device = { id: generateDeviceId(), name: '' }
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
  }

  return device
}

export function getDeviceId(): string {
  return getDevice().id
}

export function getDeviceName(): string {
  const device = getDevice()
  return device.name || `Toestel ${device.id}`
}

export function setDeviceName(name: string): void {
  const device = getDevice()
  device.name = (name || '').trim()
  localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
}

// Which real SumUp Solo reader (if any) this POS should dispatch SumUp
// charges to via the Cloud API — set from Settings' readers panel. No reader
// selected means SumUp charges keep using the local pending-queue flow
// (simulator / iOS bridge). Per-browser, not synced to the backend.
const SUMUP_READER_KEY = 'arcanum-sumup-reader'

export interface SumupReaderSelection {
  id: string
  name: string
}

export function getSumupReader(): SumupReaderSelection | null {
  try {
    return JSON.parse(localStorage.getItem(SUMUP_READER_KEY) || 'null')
  } catch (err) {
    console.error('Kon geselecteerde SumUp-reader niet laden', err)
    return null
  }
}

export function setSumupReader(reader: SumupReaderSelection | null): void {
  if (reader) {
    localStorage.setItem(SUMUP_READER_KEY, JSON.stringify(reader))
  } else {
    localStorage.removeItem(SUMUP_READER_KEY)
  }
}

// Which catalog (menukaart) this kassa sells from — set from Settings'
// Menukaart panel. None selected means the org's default catalog. A
// per-device choice for now; a Register takes this over later
// (DOMAIN_MODEL.md "Step 3 decisions"). Per-browser, not synced.
const CATALOG_KEY = 'arcanum-catalog'

export interface CatalogSelection {
  id: string
  name: string
}

export function getCatalogSelection(): CatalogSelection | null {
  try {
    return JSON.parse(localStorage.getItem(CATALOG_KEY) || 'null')
  } catch (err) {
    console.error('Kon gekozen menukaart niet laden', err)
    return null
  }
}

export function setCatalogSelection(selection: CatalogSelection | null): void {
  if (selection) {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(selection))
  } else {
    localStorage.removeItem(CATALOG_KEY)
  }
}
