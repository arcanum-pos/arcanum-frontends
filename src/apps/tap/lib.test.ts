import { describe, expect, it } from 'vitest'
import { readTapAddress, tapReturnUrl } from './lib'

describe('the Tap to Pay address', () => {
  it('a payment by its charge and token; back from the SumUp app with its status', () => {
    expect(readTapAddress('?charge=c1&t=tok')).toEqual({ chargeId: 'c1', token: 'tok', returned: null })
    expect(readTapAddress('?charge=c1&t=tok&smp-status=success&smp-tx-code=TX1')).toEqual({ chargeId: 'c1', token: 'tok', returned: 'success' })
  })
  it('nothing without both', () => {
    expect(readTapAddress('')).toBeNull()
    expect(readTapAddress('?charge=c1')).toBeNull()
  })
  it('comes back to its own address', () => {
    expect(tapReturnUrl('https://arcanum.test', 'c 1', 'a/b')).toBe('https://arcanum.test/tap?charge=c%201&t=a%2Fb')
    expect(readTapAddress(new URL(tapReturnUrl('https://arcanum.test', 'c 1', 'a/b')).search)).toMatchObject({ chargeId: 'c 1', token: 'a/b' })
  })
})
