import { formatEuro } from '@/shared/format'
import type { CustomerOrder } from '@/shared/customer-order'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import type { KassaMessages } from './messages/nl'
import type { DraftLine, TabDetail, TabLine } from './tabs-api'
import { netQuantity, shownNumber } from './tabs-api'

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

// What's on a tab per catalog variant, net of voids (the menu shows it next
// to each product, beside what's being tapped now). The tip and lines
// without a variant (from before the catalog) aren't products on the menu.
export function tabQuantities(tab: TabDetail | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of tab?.lines ?? []) {
    if (l.voidsLineId || !l.variantId || l.itemCode === FOOI_CODE) continue
    const q = netQuantity(l)
    if (q > 0) out[l.variantId] = (out[l.variantId] ?? 0) + q
  }
  return out
}

// One variant's quantity on a draft changed (0 or less: gone).
export function changeQuantity(draft: DraftLine[], variantId: string, change: (quantity: number) => number): DraftLine[] {
  return draft.flatMap((l) => {
    if (l.variantId !== variantId) return [l]
    const quantity = change(l.quantity)
    return quantity > 0 ? [{ ...l, quantity }] : []
  })
}

// What's left of a draft once `sent` went to the server: taps made while it
// was on its way stay (for the next round) — never the sent units twice.
export function subtractDraft(draft: DraftLine[], sent: DraftLine[]): DraftLine[] {
  const left = new Map(sent.map((l) => [l.variantId, l.quantity]))
  return draft
    .map((l) => {
      const gone = Math.min(left.get(l.variantId) ?? 0, l.quantity)
      left.set(l.variantId, (left.get(l.variantId) ?? 0) - gone)
      return { ...l, quantity: l.quantity - gone }
    })
    .filter((l) => l.quantity > 0)
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

type BreakdownMessages = Pick<KassaMessages, 'breakdownLine' | 'breakdownTip'>

function breakdownLine(m: BreakdownMessages, name: string, itemCode: string | null, quantity: number, unitPriceCents: number): string {
  if (itemCode === FOOI_CODE) return m.breakdownTip(formatEuro(unitPriceCents * quantity))
  return m.breakdownLine(quantity, name, formatEuro(unitPriceCents), formatEuro(quantity * unitPriceCents))
}

// What the payment view and the customer display list above the amount —
// the tab's net lines (voids subtracted, fully voided lines left out),
// plus the tip given with this payment, if any.
export function tabBreakdownLines(m: BreakdownMessages, tab: TabDetail, tipCents = 0): string[] {
  const lines = tab.lines
    .filter((l) => !l.voidsLineId && netQuantity(l) > 0)
    .map((l) => breakdownLine(m, l.name, l.itemCode, netQuantity(l), l.unitPriceCents))
  if (tipCents > 0) lines.push(m.breakdownTip(formatEuro(tipCents)))
  return lines
}

// The order as the customer display lists it: lines net of voids. (An old
// fooi line is named in the kassa's language — the display can't tell.)
export function customerOrderFromTab(m: Pick<KassaMessages, 'tip'>, tab: TabDetail): CustomerOrder {
  return {
    label: tab.label,
    number: shownNumber(tab),
    eventName: tab.eventName ?? null,
    eventId: tab.eventId ?? null,
    followUrl: tab.followUrl ?? null,
    paidCents: tab.paidCents,
    lines: tab.lines
      .filter((l) => !l.voidsLineId && netQuantity(l) > 0)
      .map((l) => ({ name: l.itemCode === FOOI_CODE ? m.tip : l.name, quantity: netQuantity(l), unitPriceCents: l.unitPriceCents })),
  }
}

// What the customer display shows while the order is entered (before the
// payment): the order on the kassa's screen — the Toog sale being entered,
// or the open tab with what's tapped in but not sent yet. Null: nothing to
// show (the display rests).
export function customerViewOrder(
  m: Pick<KassaMessages, 'tip'>,
  draft: DraftLine[],
  tab: TabDetail | null,
  eventName: string | null,
  eventId: string | null = null
): CustomerOrder | null {
  const drafted = draft.filter((l) => l.quantity > 0).map((l) => ({ name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents }))
  const base: CustomerOrder = tab ? customerOrderFromTab(m, tab) : { label: '', number: null, eventName, eventId, paidCents: 0, lines: [] }
  const lines = [...base.lines, ...drafted]
  if (lines.length === 0) return null
  // Not the follow link yet: that's for once it's paid.
  return { ...base, eventName: base.eventName ?? eventName, eventId: base.eventId ?? eventId, followUrl: null, lines }
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

// 'tap': SumUp Tap to Pay on the kassa's phone (or any phone scanning the
// payment's QR) — a SumUp payment the SumUp app takes, confirmed by SumUp.
export type PaymentMethod = 'bancontact' | 'cash' | 'sumup' | 'tap'

export interface CurrentPayment {
  method: PaymentMethod
  // Bancontact: a STATUS_MESSAGES key (PENDING/SUCCEEDED/...). Cash/SumUp:
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
  // Tap to Pay: the payment's own token — its QR's link (/tap?charge=…&t=…).
  tapToken?: string
}

export function isPaymentResolved(current: CurrentPayment): boolean {
  return current.status === 'RESOLVED' || current.status === 'SUCCEEDED'
}

// What the manual (cash/SumUp) payment view says; the text is in KassaMessages.
export type ManualStatus = { kind: 'waiting' } | { kind: 'paid' } | { kind: 'failed'; error: string | null }

export const PAYMENT_METHODS: PaymentMethod[] = ['bancontact', 'cash', 'sumup']

// The methods this kassa offers: Tap to Pay too once it's set up (console → Betaalproviders).
export const paymentMethodsFor = (tapToPay: boolean): PaymentMethod[] => (tapToPay ? [...PAYMENT_METHODS, 'tap'] : PAYMENT_METHODS)

// The link a Tap to Pay payment's QR opens: the phone page, for this payment.
export function tapLink(origin: string, chargeId: string, token: string): string {
  return `${origin}/tap?charge=${encodeURIComponent(chargeId)}&t=${encodeURIComponent(token)}`
}

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
