// What the customer display shows about the order being paid. The same
// shape arrives two ways: from the kassa over the same-device
// BroadcastChannel, and from /api/bancontact/sumup/status/:id (the
// backend's customerOrder) for a CFD on another device.
export interface CustomerOrderLine {
  name: string
  quantity: number
  unitPriceCents: number
}

export interface CustomerOrder {
  label: string
  number: number | null
  // The event the tab is tagged with, if any.
  eventName?: string | null
  // Already paid on this tab before this payment (split payments).
  paidCents?: number | null
  // Per item: the units this payment covers (null = the whole rekening or an equal part).
  paying?: CustomerOrderLine[] | null
  lines: CustomerOrderLine[]
}

// The Toog quick sale is a tab too, but "Toog" means nothing to a customer.
const UNNAMED = new Set(['toog'])

export interface CustomerBill {
  // Tab name for the header ("Tafel 4"), null for a Toog sale.
  title: string | null
  lines: { name: string; quantity: number; totalCents: number }[]
  itemCount: number
  itemsCents: number
  // Paid earlier on this tab (split payments).
  alreadyPaidCents: number
  // Still open on the tab (items − already paid); this payment may be only a part of it.
  openCents: number
  tipCents: number
  amountCents: number
}

// From the order and the charge (amount = what's still open + tip), what
// the customer reads: lines with totals, earlier payments, the tip, the total.
export function customerBill(order: CustomerOrder | null | undefined, amountCents: number, tipCents = 0): CustomerBill {
  const lines = (order?.lines ?? []).filter((l) => l.quantity > 0).map((l) => ({ name: l.name, quantity: l.quantity, totalCents: l.quantity * l.unitPriceCents }))
  const itemsCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
  const label = order?.label?.trim() || ''
  // Known from the order when it says so; else inferred (the amount pays the rest).
  const alreadyPaidCents = Number.isInteger(order?.paidCents)
    ? Math.max(0, order!.paidCents as number)
    : lines.length
      ? Math.max(0, itemsCents - (amountCents - tipCents))
      : 0
  return {
    title: label && !UNNAMED.has(label.toLowerCase()) ? label : null,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    itemsCents,
    alreadyPaidCents,
    openCents: Math.max(0, itemsCents - alreadyPaidCents),
    tipCents,
    amountCents,
  }
}

// Only what the CFD can safely show — anything else from the wire is dropped.
export function readCustomerOrder(value: unknown): CustomerOrder | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { label?: unknown; number?: unknown; eventName?: unknown; paidCents?: unknown; paying?: unknown; lines?: unknown }
  if (!Array.isArray(v.lines)) return null
  const readLines = (list: unknown[]) =>
    list
      .filter((l): l is CustomerOrderLine => !!l && typeof (l as CustomerOrderLine).name === 'string' && Number.isInteger((l as CustomerOrderLine).quantity) && Number.isInteger((l as CustomerOrderLine).unitPriceCents))
      .map((l) => ({ name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents }))
  const lines = readLines(v.lines)
  const paying = Array.isArray(v.paying) && v.paying.length ? readLines(v.paying) : null
  return {
    label: typeof v.label === 'string' ? v.label : '',
    number: Number.isInteger(v.number) ? (v.number as number) : null,
    eventName: typeof v.eventName === 'string' && v.eventName.trim() ? v.eventName.trim() : null,
    paidCents: Number.isInteger(v.paidCents) ? (v.paidCents as number) : null,
    paying,
    lines,
  }
}
