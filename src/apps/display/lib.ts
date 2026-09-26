export { STATUS_LABELS } from '@/shared/payment-labels'

export const CASH_VIEW_LABELS: Record<string, string> = {
  cash: 'Gelieve contant te betalen',
  sumup: 'Gelieve te betalen via SumUp',
  bancontact: 'Gelieve te betalen via Bancontact',
}

export const METHOD_LABELS: Record<string, string> = {
  bancontact: 'Bancontact',
  cash: 'Contant',
  sumup: 'SumUp',
}

// What the customer is told while the payment runs, per method.
export const PAY_INSTRUCTIONS: Record<string, string> = {
  bancontact: 'Open je bankapp, scan de code en bevestig. Het scherm springt automatisch verder.',
  cash: 'Betaal aan de toog — het scherm springt verder zodra de ontvangst bevestigd is.',
  sumup: 'Betaal met je kaart of gsm op de betaalterminal.',
}

// Bancontact statuses that end a payment without it being paid.
const FAILED_STATUSES = new Set(['FAILED', 'AUTHORIZATION_FAILED', 'CANCELLED', 'EXPIRED', 'VOIDED'])

export type PayPhase = 'waiting' | 'paid' | 'failed'

// One phase for every way a status arrives: Bancontact's own vocabulary,
// the kassa's AWAITING_MANUAL/RESOLVED for cash and SumUp, or the
// backend's collapsed pending/succeeded/failed.
export function payPhase(status: string | undefined): PayPhase {
  const s = (status || '').toUpperCase()
  if (s === 'SUCCEEDED' || s === 'RESOLVED') return 'paid'
  if (FAILED_STATUSES.has(s)) return 'failed'
  return 'waiting'
}
