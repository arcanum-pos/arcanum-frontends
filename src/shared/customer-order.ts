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
  // Paid earlier on this tab (a split payment); the amount now is the rest.
  alreadyPaidCents: number
  tipCents: number
  amountCents: number
}

// From the order and the charge (amount = what's still open + tip), what
// the customer reads: lines with totals, earlier payments, the tip, the total.
export function customerBill(order: CustomerOrder | null | undefined, amountCents: number, tipCents = 0): CustomerBill {
  const lines = (order?.lines ?? []).filter((l) => l.quantity > 0).map((l) => ({ name: l.name, quantity: l.quantity, totalCents: l.quantity * l.unitPriceCents }))
  const itemsCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
  const label = order?.label?.trim() || ''
  return {
    title: label && !UNNAMED.has(label.toLowerCase()) ? label : null,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    itemsCents,
    alreadyPaidCents: lines.length ? Math.max(0, itemsCents - (amountCents - tipCents)) : 0,
    tipCents,
    amountCents,
  }
}

// Only what the CFD can safely show — anything else from the wire is dropped.
export function readCustomerOrder(value: unknown): CustomerOrder | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { label?: unknown; number?: unknown; lines?: unknown }
  if (!Array.isArray(v.lines)) return null
  const lines = v.lines
    .filter((l): l is CustomerOrderLine => !!l && typeof l.name === 'string' && Number.isInteger(l.quantity) && Number.isInteger(l.unitPriceCents))
    .map((l) => ({ name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents }))
  return { label: typeof v.label === 'string' ? v.label : '', number: Number.isInteger(v.number) ? (v.number as number) : null, lines }
}
