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
