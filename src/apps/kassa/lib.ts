import { formatEuro } from '@/shared/format'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import type { DraftLine, TabDetail } from './tabs-api'
import { netQuantity } from './tabs-api'

// A tappable item: a catalog entry (variantId set — the server prices it
// from the catalog and ignores the price here, which is display-only), or
// a free line (fooi, until it moves onto the payment in step 3d).
export interface PickerItem {
  itemCode: string | null
  name: string
  unitPriceCents: number
  variantId?: string
}

export function entryToPickerItem(entry: KassaEntry): PickerItem {
  return { itemCode: entry.code, name: entry.name, unitPriceCents: entry.priceCents, variantId: entry.variantId }
}

// Fooi stays an order line until step 3d (DOMAIN_MODEL.md) — one line per
// tab, its "unit price" is the tip amount.
export const FOOI_CODE = 'fooi'

// Adds to a draft, merging with an existing line for the same catalog
// variant (or, for free lines, the same item at the same price; fooi
// merges by adding to the amount instead).
export function addToDraft(draft: DraftLine[], item: PickerItem, quantity: number): DraftLine[] {
  const i = draft.findIndex((l) =>
    item.variantId
      ? l.variantId === item.variantId
      : !l.variantId && l.itemCode === item.itemCode && (item.itemCode === FOOI_CODE || l.unitPriceCents === item.unitPriceCents)
  )
  if (i === -1) return [...draft, { ...item, quantity }]
  const next = [...draft]
  next[i] =
    item.itemCode === FOOI_CODE && !item.variantId
      ? { ...next[i], unitPriceCents: next[i].unitPriceCents + item.unitPriceCents }
      : { ...next[i], quantity: next[i].quantity + quantity }
  return next
}

// Lines every draft up with a (re)loaded catalog: catalog lines take the
// catalog's current name/price (display only — the server prices them
// anyway). With `dropMissing` (the kassa switched to a different catalog),
// catalog lines whose variant isn't on it are removed; free lines always
// stay. Returns how many lines were dropped so the kassa can say so.
export function reconcileDrafts(
  drafts: Record<string, DraftLine[]>,
  catalog: KassaCatalog | null,
  dropMissing: boolean
): { drafts: Record<string, DraftLine[]>; dropped: number } {
  const entries = new Map((catalog?.sections || []).flatMap((s) => s.entries).map((e) => [e.variantId, e]))
  let dropped = 0
  const next: Record<string, DraftLine[]> = {}
  for (const [key, lines] of Object.entries(drafts)) {
    const kept: DraftLine[] = []
    for (const line of lines) {
      const entry = line.variantId ? entries.get(line.variantId) : undefined
      if (line.variantId && !entry) {
        if (dropMissing) {
          dropped++
          continue
        }
        kept.push(line)
      } else if (entry) {
        kept.push({ ...line, name: entry.name, unitPriceCents: entry.priceCents, itemCode: entry.code })
      } else {
        kept.push(line)
      }
    }
    if (kept.length > 0) next[key] = kept
  }
  return { drafts: next, dropped }
}

export function draftTotalCents(draft: DraftLine[]): number {
  return draft.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
}

function breakdownLine(name: string, itemCode: string | null, quantity: number, unitPriceCents: number): string {
  if (itemCode === FOOI_CODE) return `Fooi = ${formatEuro(unitPriceCents * quantity)}`
  return `${quantity} × ${name} à ${formatEuro(unitPriceCents)} = ${formatEuro(quantity * unitPriceCents)}`
}

// What the payment view and the customer display list above the amount —
// the tab's net lines (voids subtracted, fully voided lines left out).
export function tabBreakdownLines(tab: TabDetail): string[] {
  return tab.lines
    .filter((l) => !l.voidsLineId && netQuantity(l) > 0)
    .map((l) => breakdownLine(l.name, l.itemCode, netQuantity(l), l.unitPriceCents))
}

export function readAmountCents(value: string): number {
  const euros = parseFloat(value.replace(',', '.'))
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : 0
}

export type PaymentMethod = 'bancontact' | 'cash' | 'sumup'

export interface CurrentPayment {
  method: PaymentMethod
  // Bancontact: a STATUS_LABELS key (PENDING/SUCCEEDED/...). Cash/SumUp:
  // 'AWAITING_MANUAL' | 'RESOLVED' — the manual view's own text is tracked
  // separately (see App's manualStatusText).
  status: string
  amountCents: number
  description?: string
  breakdown: string[]
  qrCodeUrl?: string
  expiresAt?: string
  chargeId: string
  tabId: string
  // True once a SumUp charge was actually sent to a physical reader — then
  // cancelling here can't stop the customer from still paying on it, so
  // the charge is left for the reader/poller to resolve.
  dispatchedToReader?: boolean
}

export function isPaymentResolved(current: CurrentPayment): boolean {
  return current.status === 'RESOLVED' || current.status === 'SUCCEEDED'
}

export const MANUAL_METHOD_LABELS: Record<'cash' | 'sumup', { waiting: string; confirmBtn: string; paid: string }> = {
  cash: {
    waiting: 'Wacht op contante betaling',
    confirmBtn: 'Bevestig ontvangst contant geld',
    paid: 'Betaald (contant)',
  },
  sumup: {
    waiting: 'Wacht op SumUp betaling (automatisch, of bevestig hieronder)',
    confirmBtn: 'Bevestig SumUp betaling',
    paid: 'Betaald (SumUp)',
  },
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'bancontact', label: 'Bancontact' },
  { value: 'cash', label: 'Contant' },
  { value: 'sumup', label: 'SumUp' },
]
