// The station screen's pure parts (tested in lib.test.ts).

export type TicketStatus = 'ordered' | 'in_progress' | 'ready' | 'delivered'

export interface Ticket {
  id: string
  tabId: string
  status: TicketStatus
  createdAt: string
  updatedAt: string
  number: number
  label: string
  paid: boolean
  // On a tab paid when the guest leaves: prepared unpaid.
  payLater?: boolean
  selfOrder: boolean
  // Its ordering mode ("Take away") when the event has more than one —
  // information only: the station got it from the products' prep station.
  mode?: string | null
  // Who's making it (a staff member), when someone is.
  claimedBy?: { id: string | null; name: string; at: string | null } | null
  lines: { name: string; quantity: number; voided: number; note: string | null }[]
}

const ORDER: TicketStatus[] = ['ordered', 'in_progress', 'ready', 'delivered']

export function nextStatus(status: TicketStatus): TicketStatus | null {
  return ORDER[ORDER.indexOf(status) + 1] ?? null
}

export function previousStatus(status: TicketStatus): TicketStatus | null {
  return ORDER[ORDER.indexOf(status) - 1] ?? null
}

// What the filters let through, and how many unpaid ones they hide (said on
// screen, so nobody wonders where an order went). "Only paid" never hides an
// order on a tab paid when leaving — those are made unpaid on purpose.
// "Alleen mijn bonnen" (`mine`: the device's person) hides what colleagues
// are making — new ones nobody took yet stay, to be picked up.
export function visibleTickets(tickets: Ticket[], filters: { onlyPaid: boolean; showDelivered: boolean; mine?: string | null }) {
  const payable = (t: Ticket) => t.paid || !!t.payLater
  const others = (t: Ticket) => !!filters.mine && !!t.claimedBy?.id && t.claimedBy.id !== filters.mine
  const shown = tickets.filter((t) => (!filters.onlyPaid || payable(t)) && (filters.showDelivered || t.status !== 'delivered') && !others(t))
  const hiddenUnpaid = filters.onlyPaid ? tickets.filter((t) => !payable(t) && t.status !== 'delivered').length : 0
  return { shown, hiddenUnpaid }
}

// --- The pickup screen (ROADMAP.md §5): what guests see, read-only.

export interface PickupOrder {
  number: number
  status: 'ordered' | 'in_progress' | 'ready'
  mode?: string | null
  updatedAt: string
}

// How long a number stays under "Klaar" when nobody marks it delivered —
// the backend leaves it out after this too (PICKUP_READY_MINUTES).
export const PICKUP_READY_MINUTES = 15

// The three columns, each by number; a ready one only while it's fresh
// (the screen re-renders now and then — no fetching needed for that).
export function pickupColumns(orders: PickupOrder[], now: number) {
  const fresh = (o: PickupOrder) => now - Date.parse(o.updatedAt) < PICKUP_READY_MINUTES * 60_000
  const by = (status: PickupOrder['status']) => orders.filter((o) => o.status === status && (status !== 'ready' || fresh(o))).sort((a, b) => a.number - b.number)
  return { received: by('ordered'), preparing: by('in_progress'), ready: by('ready') }
}
