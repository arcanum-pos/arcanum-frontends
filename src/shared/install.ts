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

export const isRole = (value: string | null): value is Role => !!value && value in ICON_FOR_ROLE

// The pairing link's device: its icon, the name under it, and a manifest
// (arcanum-bff, /pair/manifest.webmanifest) — so the app added from this
// page is that device, not "Arcanum".
export function showAsDevice(role: Role, name: string) {
  const icon = ICON_FOR_ROLE[role]
  const set = (selector: string, attr: string, value: string) => document.head.querySelector(selector)?.setAttribute(attr, value)
  set('link[rel="icon"]', 'href', `/icons/${icon}-96.png`)
  set('link[rel="apple-touch-icon"]', 'href', `/icons/${icon}-180.png`)
  set('link[rel="manifest"]', 'href', `/pair/manifest.webmanifest?${new URLSearchParams({ role, name })}`)
  set('meta[name="apple-mobile-web-app-title"]', 'content', name)
  document.title = name
}

// Set by the pairing page right after pairing in a browser that shares its
// storage with an installed app: the screen then offers to install itself.
export const OFFER_INSTALL_KEY = 'arcanum-offer-install'
