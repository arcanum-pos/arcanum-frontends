import { formatEuro, pluralize } from '@/shared/format'

// NOTE: this catalogue (bonnen/fietstocht/wandeltocht/fooi) is one specific
// org's item taxonomy, hardcoded — same as it was in arcanum-webapp. Only
// the *prices* are org-configurable (via worker's /settings); the shape of
// the catalogue itself is not data-driven. Ported verbatim, not genericized
// — that would be a real scope change, not a styling port.

export interface OrderItems {
  bon?: number
  fietstocht?: number
  fietstochtMember?: number
  wandeltocht?: number
  wandeltochtMember?: number
  fooi?: number
}

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

export type PaymentMethod = 'bancontact' | 'cash' | 'sumup'

export interface CurrentPayment {
  method: PaymentMethod
  // Bancontact: a STATUS_LABELS key (PENDING/SUCCEEDED/...). Cash/SumUp:
  // 'AWAITING_MANUAL' | 'RESOLVED' — the manual view's own text is tracked
  // separately (see App's manualStatusText).
  status: string
  amountCents: number
  description?: string
  items?: OrderItems
  breakdown: string[]
  qrCodeUrl?: string
  expiresAt?: string
  chargeId?: string | null
}

export function buildBreakdownLines(items: OrderItems, pricing: Pricing): string[] {
  const lines: string[] = []
  if (items.bon) {
    lines.push(
      `${items.bon} ${pluralize(items.bon, 'bon', 'bonnen')} × ${formatEuro(pricing.amountPerBonCents)} = ${formatEuro(items.bon * pricing.amountPerBonCents)}`
    )
  }
  if (items.fietstocht) {
    lines.push(
      `${items.fietstocht} ${pluralize(items.fietstocht, 'fietstocht', 'fietstochten')} × ${formatEuro(pricing.fietstochtNonMemberCents)} = ${formatEuro(items.fietstocht * pricing.fietstochtNonMemberCents)}`
    )
  }
  if (items.fietstochtMember) {
    lines.push(
      `${items.fietstochtMember} ${pluralize(items.fietstochtMember, 'fietstocht', 'fietstochten')} (lid) × ${formatEuro(pricing.fietstochtMemberCents)} = ${formatEuro(items.fietstochtMember * pricing.fietstochtMemberCents)}`
    )
  }
  if (items.wandeltocht) {
    lines.push(
      `${items.wandeltocht} ${pluralize(items.wandeltocht, 'wandeltocht', 'wandeltochten')} × ${formatEuro(pricing.wandeltochtNonMemberCents)} = ${formatEuro(items.wandeltocht * pricing.wandeltochtNonMemberCents)}`
    )
  }
  if (items.wandeltochtMember) {
    lines.push(
      `${items.wandeltochtMember} ${pluralize(items.wandeltochtMember, 'wandeltocht', 'wandeltochten')} (lid) × ${formatEuro(pricing.wandeltochtMemberCents)} = ${formatEuro(items.wandeltochtMember * pricing.wandeltochtMemberCents)}`
    )
  }
  if (items.fooi) {
    lines.push(`Fooi = ${formatEuro(items.fooi)}`)
  }
  return lines
}

export function itemsTotalCents(items: OrderItems, pricing: Pricing): number {
  return (
    (items.bon || 0) * pricing.amountPerBonCents +
    (items.fietstocht || 0) * pricing.fietstochtNonMemberCents +
    (items.fietstochtMember || 0) * pricing.fietstochtMemberCents +
    (items.wandeltocht || 0) * pricing.wandeltochtNonMemberCents +
    (items.wandeltochtMember || 0) * pricing.wandeltochtMemberCents +
    (items.fooi || 0)
  )
}

export function readCount(value: string): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function readAmountCents(value: string): number {
  const euros = parseFloat(value)
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : 0
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
