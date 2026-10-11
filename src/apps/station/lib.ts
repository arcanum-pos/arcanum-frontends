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
  selfOrder: boolean
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
// screen, so nobody wonders where an order went).
export function visibleTickets(tickets: Ticket[], filters: { onlyPaid: boolean; showDelivered: boolean }) {
  const shown = tickets.filter((t) => (!filters.onlyPaid || t.paid) && (filters.showDelivered || t.status !== 'delivered'))
  const hiddenUnpaid = filters.onlyPaid ? tickets.filter((t) => !t.paid && t.status !== 'delivered').length : 0
  return { shown, hiddenUnpaid }
}
