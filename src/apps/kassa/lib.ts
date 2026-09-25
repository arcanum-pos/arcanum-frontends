import { formatEuro } from '@/shared/format'
import type { DraftLine, TabDetail } from './tabs-api'
import { netQuantity } from './tabs-api'

// NOTE: this catalogue (bonnen/fietstocht/wandeltocht/fooi) is one specific
// org's item taxonomy, hardcoded — same as it was in arcanum-webapp. Only
// the *prices* are org-configurable (via worker's /settings). It's replaced
// by a real catalog in step 3 (see DOMAIN_MODEL.md); until then the item
// codes below must stay the legacy `items` JSON keys, since the backend
// derives transactions.items from them and every report reads that.

export interface Pricing {
  amountPerBonCents: number
  fietstochtMemberCents: number
  fietstochtNonMemberCents: number
  wandeltochtMemberCents: number
  wandeltochtNonMemberCents: number
}

export const DEFAULT_PRICING: Pricing = {
  amountPerBonCents: 100,
  fietstochtMemberCents: 600,
  fietstochtNonMemberCents: 800,
  wandeltochtMemberCents: 400,
  wandeltochtNonMemberCents: 600,
}

export interface PickerItem {
  itemCode: string
  name: string
  unitPriceCents: number
}

export function pickerItems(pricing: Pricing): PickerItem[] {
  return [
    { itemCode: 'bon', name: 'Bon', unitPriceCents: pricing.amountPerBonCents },
    { itemCode: 'fietstocht', name: 'Fietstocht', unitPriceCents: pricing.fietstochtNonMemberCents },
    { itemCode: 'fietstochtMember', name: 'Fietstocht (lid)', unitPriceCents: pricing.fietstochtMemberCents },
    { itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: pricing.wandeltochtNonMemberCents },
    { itemCode: 'wandeltochtMember', name: 'Wandeltocht (lid)', unitPriceCents: pricing.wandeltochtMemberCents },
  ]
}

// Fooi stays an order line until the catalog step (DOMAIN_MODEL.md
// decisions) — one line per tab, its "unit price" is the tip amount.
export const FOOI_CODE = 'fooi'

// Adds to a draft, merging with an existing line for the same item at the
// same price (fooi merges by adding to the amount instead).
export function addToDraft(draft: DraftLine[], item: PickerItem, quantity: number): DraftLine[] {
  const i = draft.findIndex((l) => l.itemCode === item.itemCode && (item.itemCode === FOOI_CODE || l.unitPriceCents === item.unitPriceCents))
  if (i === -1) return [...draft, { ...item, quantity }]
  const next = [...draft]
  next[i] =
    item.itemCode === FOOI_CODE
      ? { ...next[i], unitPriceCents: next[i].unitPriceCents + item.unitPriceCents }
      : { ...next[i], quantity: next[i].quantity + quantity }
  return next
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
