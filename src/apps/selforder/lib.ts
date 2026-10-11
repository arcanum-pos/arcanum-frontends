// The self-order pages' pure parts (tested in lib.test.ts).

export interface MenuEntry {
  variantId: string
  name: string
  priceCents: number
}

export interface Menu {
  eventName: string
  orgName: string
  locale: string
  open: boolean
  catalog: { id: string; sections: { id: string; name: string; entries: MenuEntry[] }[] } | null
}

export type FollowState = 'cancelled' | 'awaiting_payment' | 'nothing_to_prepare' | 'preparing' | 'ready' | 'delivered'

export interface FollowStatus {
  number: number
  eventName: string | null
  orgName: string
  locale: string
  selfOrder: boolean
  state: FollowState
  stations: { name: string; status: 'ordered' | 'in_progress' | 'ready' | 'delivered' }[]
  lines: { name: string; quantity: number; unitPriceCents: number }[]
  totalCents: number
  selfOrderCode: string | null
  hubTicket: string | null
}

export type Cart = Record<string, number>

// Where this page is: /bestel/<event code> (ordering) or /volg/<token> (following).
export function route(pathname: string): { kind: 'order'; code: string } | { kind: 'follow'; token: string } | null {
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
export function cartLines(cart: Cart, menu: Menu | null): (MenuEntry & { quantity: number })[] {
  const entries = menu?.catalog?.sections.flatMap((s) => s.entries) ?? []
  return entries.filter((e) => cart[e.variantId]).map((e) => ({ ...e, quantity: cart[e.variantId] }))
}

export function cartTotals(lines: { quantity: number; priceCents: number }[]) {
  return { count: lines.reduce((n, l) => n + l.quantity, 0), cents: lines.reduce((n, l) => n + l.quantity * l.priceCents, 0) }
}

// What this phone remembers per event: the cart, and the order it placed
// (so a reload comes back to step 4). A private window: nothing.
const key = (code: string) => `arcanum-selforder:${code}`

export function loadSaved(code: string): { cart: Cart; token: string | null } {
  try {
    const value = JSON.parse(localStorage.getItem(key(code)) || 'null')
    return { cart: value?.cart && typeof value.cart === 'object' ? value.cart : {}, token: typeof value?.token === 'string' ? value.token : null }
  } catch {
    return { cart: {}, token: null }
  }
}

export function save(code: string, value: { cart: Cart; token: string | null }) {
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
