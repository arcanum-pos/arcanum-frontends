// The customer display's phase from whatever status word arrives: the
// kassa's, the backend's, or a provider's own (Bancontact's, SumUp's).
import { describe, expect, it } from 'vitest'
import { payPhase } from './lib'

describe('payPhase', () => {
  it('paid: the backend, the kassa, Bancontact and SumUp each say it their way', () => {
    for (const s of ['succeeded', 'SUCCEEDED', 'RESOLVED', 'successful']) expect(payPhase(s), s).toBe('paid')
  })
  it('failed: incl. an expired SumUp payment', () => {
    for (const s of ['failed', 'FAILED', 'CANCELLED', 'EXPIRED', 'AUTHORIZATION_FAILED', 'VOIDED', 'TIMED_OUT']) expect(payPhase(s), s).toBe('failed')
  })
  it('anything else is still waiting', () => {
    for (const s of ['pending', 'PENDING', 'IDENTIFIED', 'AWAITING_MANUAL', undefined]) expect(payPhase(s), String(s)).toBe('waiting')
  })
})
