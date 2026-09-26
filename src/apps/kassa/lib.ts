import { formatEuro } from '@/shared/format'
import type { CustomerOrder } from '@/shared/customer-order'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import type { DraftLine, TabDetail, TabLine } from './tabs-api'
import { netQuantity } from './tabs-api'

// A tappable item: a catalog entry. The server prices it from the catalog
// and ignores the price here, which is display-only.
export interface PickerItem {
  itemCode: string | null
  name: string
  unitPriceCents: number
  variantId: string
}

export function entryToPickerItem(entry: KassaEntry): PickerItem {
  return { itemCode: entry.code, name: entry.name, unitPriceCents: entry.priceCents, variantId: entry.variantId }
}

// Fooi used to be an order line (until step 3d); it's now a tip on the
// payment (tipCents). Old tabs may still carry such a line — display only.
export const FOOI_CODE = 'fooi'

// Adds to a draft, merging with an existing line for the same catalog variant.
export function addToDraft(draft: DraftLine[], item: PickerItem, quantity: number): DraftLine[] {
  const i = draft.findIndex((l) => l.variantId === item.variantId)
  if (i === -1) return [...draft, { ...item, quantity }]
  const next = [...draft]
  next[i] = { ...next[i], quantity: next[i].quantity + quantity }
  return next
}

// Lines every draft up with a (re)loaded catalog: catalog lines take the
// catalog's current name/price (display only — the server prices them
// anyway). With `dropMissing` (the kassa switched to a different catalog),
// catalog lines whose variant isn't on it are removed. Returns how many
// lines were dropped so the kassa can say so.
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
      const entry = entries.get(line.variantId)
      if (entry) {
        kept.push({ ...line, name: entry.name, unitPriceCents: entry.priceCents, itemCode: entry.code })
      } else if (dropMissing) {
        dropped++
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
// the tab's net lines (voids subtracted, fully voided lines left out),
// plus the tip given with this payment, if any.
export function tabBreakdownLines(tab: TabDetail, tipCents = 0): string[] {
  const lines = tab.lines
    .filter((l) => !l.voidsLineId && netQuantity(l) > 0)
    .map((l) => breakdownLine(l.name, l.itemCode, netQuantity(l), l.unitPriceCents))
  if (tipCents > 0) lines.push(`Fooi = ${formatEuro(tipCents)}`)
  return lines
}

// The order as the customer display lists it: lines net of voids.
export function customerOrderFromTab(tab: TabDetail): CustomerOrder {
  return {
    label: tab.label,
    number: tab.number,
    eventName: tab.eventName ?? null,
    paidCents: tab.paidCents,
    lines: tab.lines
      .filter((l) => !l.voidsLineId && netQuantity(l) > 0)
      .map((l) => ({ name: l.itemCode === FOOI_CODE ? 'Fooi' : l.name, quantity: netQuantity(l), unitPriceCents: l.unitPriceCents })),
  }
}

// Max tip the backend accepts (tipCents 0..100000).
export const MAX_TIP_CENTS = 100_000

// The tip that rounds amount + tip up to the next whole euro (0 when the
// amount already is one).
export function roundUpTipCents(amountCents: number): number {
  const rest = amountCents % 100
  return rest === 0 ? 0 : 100 - rest
}

export function clampTip(cents: number): number {
  return Math.min(Math.max(0, Math.round(cents)), MAX_TIP_CENTS)
}

// Cents back to the kassa's comma input ("2,50"), '' for no tip.
export function centsToInput(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : ''
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
  // The order for the customer display (same shape the backend's charge status gives).
  order?: CustomerOrder
  qrCodeUrl?: string
  expiresAt?: string
  chargeId: string
  tabId: string
  // Part of amountCents — paid by the customer, but not revenue.
  tipCents: number
  // One part of an equal split ("deel 2 van 3"); absent for a full payment.
  part?: { index: number; of: number }
  // Something stays open on the rekening after this payment (a part, or an item payment).
  remainsOpen?: boolean
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

// --- Search and group filter (kassa product picker) ---

// "Vol-au-vent", "vol au vent" and "VOL-AU-VÉNT" are the same search.
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Every word of the query must appear in the product's name or code
// ("steak kind" finds "Steak (kind)"); a section filter (null = all)
// narrows it to one group. Empty sections are left out.
export function filterSections(sections: KassaCatalog['sections'], query: string, sectionId: string | null): KassaCatalog['sections'] {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  return sections
    .filter((s) => !sectionId || s.id === sectionId)
    .map((s) => ({
      ...s,
      entries: words.length
        ? s.entries.filter((e) => {
            const haystack = `${normalizeSearch(e.name)} ${normalizeSearch(e.code ?? '')}`
            return words.every((w) => haystack.includes(w))
          })
        : s.entries,
    }))
    .filter((s) => s.entries.length > 0)
}

// Enter in the search field adds a product when it's unambiguous: an exact
// code ("typ een code") or the only product left.
export function searchPick(sections: KassaCatalog['sections'], query: string): KassaEntry | null {
  const q = normalizeSearch(query)
  if (!q) return null
  const all = sections.flatMap((s) => s.entries)
  const byCode = all.filter((e) => e.code && normalizeSearch(e.code) === q)
  if (byCode.length === 1) return byCode[0]
  const matches = filterSections(sections, query, null).flatMap((s) => s.entries)
  return matches.length === 1 ? matches[0] : null
}

// The parts an equal split of `cents` over `parts` comes to — by the same
// rule the server uses: each part is what's still open ÷ parts left,
// rounded down, so the last one takes what remains. 2600 / 3 → 866, 867, 867.
export function splitSequence(cents: number, parts: number): number[] {
  const out: number[] = []
  let open = cents
  for (let left = parts; left >= 1; left--) {
    const part = left === 1 ? open : Math.floor(open / left)
    out.push(part)
    open -= part
  }
  return out
}

// "3 × € 25,83" or "€ 8,66 + 2 × € 8,67" — the parts, equal ones grouped.
export function splitPreviewText(cents: number, parts: number): string {
  const groups: { cents: number; count: number }[] = []
  for (const part of splitSequence(cents, parts)) {
    const last = groups[groups.length - 1]
    if (last && last.cents === part) last.count++
    else groups.push({ cents: part, count: 1 })
  }
  return groups.map((g) => (g.count === 1 ? formatEuro(g.cents) : `${g.count} × ${formatEuro(g.cents)}`)).join(' + ')
}

export const MAX_SPLIT_PARTS = 50

// --- Split per item ---

// Units of a submitted line that can still be paid per item: not voided,
// not paid yet.
export function payableUnits(line: TabLine): number {
  return line.voidsLineId ? 0 : Math.max(0, netQuantity(line) - (line.paidQuantity || 0))
}

// A selection is { lineId: units }; only units that are still payable count.
export type ItemSelection = Record<string, number>

export function selectionLines(tab: TabDetail, selection: ItemSelection): { line: TabLine; quantity: number }[] {
  return tab.lines
    .filter((l) => !l.voidsLineId)
    .map((line) => ({ line, quantity: Math.min(selection[line.id] || 0, payableUnits(line)) }))
    .filter((x) => x.quantity > 0)
}

export function selectionCents(tab: TabDetail, selection: ItemSelection): number {
  return selectionLines(tab, selection).reduce((sum, x) => sum + x.quantity * x.line.unitPriceCents, 0)
}

// "Alles wat open is": every unit still payable.
export function selectAllPayable(tab: TabDetail): ItemSelection {
  return Object.fromEntries(tab.lines.filter((l) => payableUnits(l) > 0).map((l) => [l.id, payableUnits(l)]))
}
