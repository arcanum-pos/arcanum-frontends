// The self-order pages' pure parts (tested in lib.test.ts).

export interface MenuEntry {
  variantId: string
  name: string
  priceCents: number
}

export interface MenuCatalog {
  id: string
  sections: { id: string; name: string; entries: MenuEntry[] }[]
}

// An ordering mode guests choose from ("Ter plaatse", "Take away"): its own
// menu, and how guests pay (tab: they keep ordering on their tab and pay
// when they leave).
export interface MenuMode {
  id: string
  name: string
  payment: { counter: boolean; bancontact: boolean; tab?: boolean }
  // On a tab: a name and a mobile number or e-mail asked when it opens.
  contact?: boolean
  catalog: MenuCatalog
}

export interface Menu {
  eventName: string
  orgName: string
  // Its own app icon (org-icons): absent from an older backend.
  orgId?: string
  locale: string
  open: boolean
  modes: MenuMode[]
}

// The mode ordered in: the one chosen — or, with only one, that one. A
// direct link carries a mode's first 8 characters (enough within an event).
export function pickMode(menu: Menu | null, modeId: string | null): MenuMode | null {
  const modes = menu?.modes ?? []
  if (modeId) {
    const exact = modes.find((mode) => mode.id === modeId)
    if (exact) return exact
    const prefixed = modeId.length >= 8 ? modes.filter((mode) => mode.id.startsWith(modeId)) : []
    return prefixed.length === 1 ? prefixed[0] : null
  }
  return modes.length === 1 ? modes[0] : null
}

export interface BancontactLinks {
  deeplinkUrl: string | null
  checkoutUrl: string | null
  qrCodeUrl: string | null
}

// On a phone the Bancontact app opens on the payment (the deeplink); on a
// computer Bancontact's own checkout page (a QR to scan with a phone).
export function bancontactTarget(links: BancontactLinks, phone: boolean): string | null {
  return (phone ? links.deeplinkUrl ?? links.checkoutUrl : links.checkoutUrl ?? links.deeplinkUrl) ?? null
}

export type FollowState = 'cancelled' | 'awaiting_payment' | 'nothing_to_prepare' | 'preparing' | 'ready' | 'delivered'

export interface FollowStatus {
  number: number
  eventName: string | null
  orgName: string
  orgId?: string
  locale: string
  selfOrder: boolean
  // Its ordering mode (another round orders from its menu), and the mode's
  // name when the event has more than one.
  modeId?: string | null
  mode?: string | null
  // A tab paid when leaving, still open: more rounds, and settling it.
  payLater?: boolean
  tabOpen?: boolean
  state: FollowState
  stations: { name: string; status: 'ordered' | 'in_progress' | 'ready' | 'delivered' }[]
  lines: { name: string; quantity: number; unitPriceCents: number }[]
  totalCents: number
  selfOrderCode: string | null
  hubTicket: string | null
  // While waiting for payment (a self-order): how it can be paid, a payment
  // in progress, the last one failed.
  payment?: { counter: boolean; bancontact: boolean; pending: boolean; failed: boolean } | null
  // An SMS when a station's part is ready (MESSAGING.md): whether a number
  // can be given now, the one given (masked: "••• 56"), how each station's went.
  sms?: { available: boolean; phone: string | null; stations: { name: string; status: 'sending' | 'sent' | 'failed' }[] } | null
  // A notification on this phone when a station's part is ready (Web Push,
  // release G'): the key to subscribe with; this order has a browser already.
  push?: { publicKey: string; available: boolean; subscribed: boolean } | null
}

export type Cart = Record<string, number>

// Where this page is: /bestel/<event code> (ordering) or /volg/<token> (following).
// A link straight to one ordering mode (a poster at the take-away window): ?m=<mode id>.
export function modeFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('m')
  return id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null
}

export function route(pathname: string): { kind: 'order'; code: string } | { kind: 'follow'; token: string } | { kind: 'table'; token: string } | null {
  // A table's QR code (release C): its guests order on the table's tab.
  const table = pathname.match(/^\/tafel\/([A-Za-z0-9_-]+)\/?$/)
  if (table) return { kind: 'table', token: table[1] }
  const order = pathname.match(/^\/bestel\/([A-Za-z0-9_-]+)\/?$/)
  if (order) return { kind: 'order', code: order[1] }
  const follow = pathname.match(/^\/volg\/([A-Za-z0-9_-]+)\/?$/)
  if (follow) return { kind: 'follow', token: follow[1] }
  return null
}

// The backend's limits (self-order.ts): at most 20 of a kind, 30 kinds.
export const MAX_QUANTITY = 20
export const MAX_KINDS = 30

export function changeQuantity(cart: Cart, variantId: string, delta: number): Cart {
  const quantity = Math.max(0, Math.min(MAX_QUANTITY, (cart[variantId] || 0) + delta))
  const next = { ...cart }
  if (quantity === 0) delete next[variantId]
  else if (!cart[variantId] && Object.keys(cart).length >= MAX_KINDS) return cart
  else next[variantId] = quantity
  return next
}

// The cart's lines in the menu's order, priced from the menu — anything no
// longer on it (the menu changed) left out.
export function cartLines(cart: Cart, catalog: MenuCatalog | null | undefined): (MenuEntry & { quantity: number })[] {
  const entries = catalog?.sections.flatMap((s) => s.entries) ?? []
  return entries.filter((e) => cart[e.variantId]).map((e) => ({ ...e, quantity: cart[e.variantId] }))
}

export function cartTotals(lines: { quantity: number; priceCents: number }[]) {
  return { count: lines.reduce((n, l) => n + l.quantity, 0), cents: lines.reduce((n, l) => n + l.quantity * l.priceCents, 0) }
}

// What this phone remembers per event: the cart, the ordering mode chosen,
// and the order it placed (so a reload comes back to step 4). A private
// window: nothing — hence step 4's "keep this link".
const key = (code: string) => `arcanum-selforder:${code}`

export interface Saved {
  cart: Cart
  token: string | null
  modeId: string | null
}

export function loadSaved(code: string): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(key(code)) || 'null')
    return {
      cart: value?.cart && typeof value.cart === 'object' ? value.cart : {},
      token: typeof value?.token === 'string' ? value.token : null,
      modeId: typeof value?.modeId === 'string' ? value.modeId : null,
    }
  } catch {
    return { cart: {}, token: null, modeId: null }
  }
}

export function save(code: string, value: Saved) {
  try {
    localStorage.setItem(key(code), JSON.stringify(value))
  } catch {
    // not remembered
  }
}

// Where to pick up: the stations that are ready (or all, once everything is).
export function readyPlaces(status: FollowStatus): string[] {
  return status.stations.filter((s) => s.status === 'ready').map((s) => s.name)
}

// Something new became ready since the last status — time for the signal.
export function newlyReady(before: FollowStatus | null, after: FollowStatus): boolean {
  const was = new Set(before ? readyPlaces(before) : [])
  return readyPlaces(after).some((name) => !was.has(name))
}

export const isFinal = (state: FollowState) => state === 'delivered' || state === 'cancelled' || state === 'nothing_to_prepare'

// Nothing more will happen to it: final, and not a tab that's still open
// (more rounds can come, it still has to be settled).
export const isDone = (status: Pick<FollowStatus, 'state' | 'tabOpen'>) => !status.tabOpen && isFinal(status.state)

// Where a follow page goes when it opens (not when its order changes while
// open). A home-screen app opens the order it was added from, every time:
// once that's finished — collected, paid, not an open tab — straight to the
// event's menu; or to the order this phone placed since, if there is one.
// Cancelled stays: it says why (not paid in time). A kassa customer's order
// (no event to order from) stays too.
export function onOpen(status: Pick<FollowStatus, 'state' | 'tabOpen' | 'selfOrderCode'>, token: string, savedToken: string | null): 'stay' | 'menu' | { token: string } {
  const finished = !status.tabOpen && (status.state === 'delivered' || status.state === 'nothing_to_prepare')
  if (!finished || !status.selfOrderCode) return 'stay'
  return savedToken && savedToken !== token ? { token: savedToken } : 'menu'
}
