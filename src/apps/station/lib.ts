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
export function visibleTickets(tickets: Ticket[], filters: { onlyPaid: boolean; showDelivered: boolean }) {
  const payable = (t: Ticket) => t.paid || !!t.payLater
  const shown = tickets.filter((t) => (!filters.onlyPaid || payable(t)) && (filters.showDelivered || t.status !== 'delivered'))
  const hiddenUnpaid = filters.onlyPaid ? tickets.filter((t) => !payable(t) && t.status !== 'delivered').length : 0
  return { shown, hiddenUnpaid }
}
