// A device screen as an app (README "App icons", DOMAIN_MODEL.md "Devices":
// install first, then pair). Safari — every browser on an iPhone or iPad,
// Safari 17+ on a Mac — gives an app added to the home screen or Dock its
// own storage and cookies: a device paired in the browser isn't paired in
// the app. There the app is installed first, from the pairing link, and
// pairs itself. Chrome, Edge and Android share them with the browser: pair
// first, then install (InstallPrompt).
import { isIos } from './push'
import type { Role } from './terminal'

export type AppStorage = 'ios' | 'mac' | 'shared'

export function appStorage(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): AppStorage {
  if (isIos(ua, touchPoints)) return 'ios'
  const safari = /Macintosh/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua) && ua.match(/Version\/(\d+)[.\d]* Safari/)
  return safari && Number(safari[1]) >= 17 ? 'mac' : 'shared'
}

// A role's icon set (public/icons/, scripts/app-icons.mjs).
export const ICON_FOR_ROLE: Record<Role, string> = { pos: 'kassa', cfd: 'display', station: 'station', tap: 'tap' }

export const isRole = (value: string | null): value is Role => !!value && Object.hasOwn(ICON_FOR_ROLE, value)

const setHead = (selector: string, attr: string, value: string) => document.head.querySelector(selector)?.setAttribute(attr, value)

// An organisation's own app icon for a page (console → Instellingen →
// Weergave → App-iconen; arcanum-bff serves the org's, else the default):
// `slot` is the page — kassa, display, station, pickup, entrance, tap,
// waiter, selforder — or station-<prep station id>.
export const orgIconRef = (orgId: string, slot: string) => `${orgId}/${slot}`
export const orgIconUrl = (orgId: string, slot: string, size: number) => `/icons/org/${encodeURIComponent(orgId)}/${slot}-${size}.png`

// A device's slot: its role, and for a station screen its view or prep station.
export function iconSlot(role: Role, station?: { stationId?: string | null; view?: string | null }): string {
  if (role === 'pos') return 'kassa'
  if (role === 'cfd') return 'display'
  if (role === 'tap') return 'tap'
  if (station?.view === 'pickup') return 'pickup'
  if (station?.view === 'tables') return 'entrance'
  return station?.stationId ? `station-${station.stationId}` : 'station'
}

// This page, now that it knows its organisation: that org's icons (the
// tab, and installing from here in Chrome, Edge or Android) — and its
// manifest, where the page has one. Safari takes what the page was sent
// with: there the pairing link's (`icon=`) do it.
export function showOrgIcons(orgId: string, slot: string, name?: string) {
  setHead('link[rel="icon"]', 'href', orgIconUrl(orgId, slot, 96))
  setHead('link[rel="apple-touch-icon"]', 'href', orgIconUrl(orgId, slot, 180))
  const manifest = new URLSearchParams(name ? { name } : {})
  setHead('link[rel="manifest"][href^="/icons/"]', 'href', `/icons/org/${encodeURIComponent(orgId)}/${slot}.webmanifest${name ? `?${manifest}` : ''}`)
}

// The pairing link's device: its icon, the name under it, and a manifest —
// what arcanum-bff sends /pair with already (Safari reads only that); for a
// page served without it (vite preview). `icon`: the org's own (<org>/<slot>).
export function showAsDevice(role: Role, name: string, icon?: string | null) {
  const [orgId, slot] = icon?.split('/') ?? []
  if (orgId && slot) {
    setHead('link[rel="icon"]', 'href', orgIconUrl(orgId, slot, 96))
    setHead('link[rel="apple-touch-icon"]', 'href', orgIconUrl(orgId, slot, 180))
    setHead('link[rel="manifest"]', 'href', `/icons/org/${encodeURIComponent(orgId)}/${slot}.webmanifest?${new URLSearchParams({ name })}`)
  } else {
    const set = ICON_FOR_ROLE[role]
    setHead('link[rel="icon"]', 'href', `/icons/${set}-96.png`)
    setHead('link[rel="apple-touch-icon"]', 'href', `/icons/${set}-180.png`)
    setHead('link[rel="manifest"]', 'href', `/pair/manifest.webmanifest?${new URLSearchParams({ role, name })}`)
  }
  setHead('meta[name="apple-mobile-web-app-title"]', 'content', name)
  document.title = name
}

// Set by the pairing page right after pairing in a browser that shares its
// storage with an installed app: the screen then offers to install itself.
export const OFFER_INSTALL_KEY = 'arcanum-offer-install'
