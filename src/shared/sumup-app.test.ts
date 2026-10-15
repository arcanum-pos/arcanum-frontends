import { describe, expect, it } from 'vitest'
import { isAndroid, sumupAppLink, sumupAppReturn } from './sumup-app'

const base = { affiliateKey: 'sup_afk_k', appId: 'be.club.pos', amountCents: 1250, title: 'Tafel 5', chargeId: 'c1', returnUrl: 'https://pos.example/bediening?sumup-charge=c1&table=t5' }

describe('sumupAppLink', () => {
  it('iOS: amount, both callbacks to our page', () => {
    const url = new URL(sumupAppLink(base, false))
    expect(url.protocol).toBe('sumupmerchant:')
    const q = new URLSearchParams(url.search)
    expect(q.get('amount')).toBe('12.50')
    expect(q.get('foreign-tx-id')).toBe('c1')
    expect(q.get('affiliate-key')).toBe('sup_afk_k')
    expect(q.get('callbacksuccess')).toBe(base.returnUrl)
    expect(q.get('callbackfail')).toBe(base.returnUrl)
    expect(q.has('app-id')).toBe(false)
  })

  it('Android: total, the app id, one callback', () => {
    const q = new URLSearchParams(new URL(sumupAppLink(base, true)).search)
    expect(q.get('total')).toBe('12.50')
    expect(q.get('app-id')).toBe('be.club.pos')
    expect(q.get('callback')).toBe(base.returnUrl)
  })

  it('tells Android from iOS', () => {
    expect(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true)
    expect(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)')).toBe(false)
  })
})

describe('sumupAppReturn', () => {
  it('reads what the app added to our page', () => {
    expect(sumupAppReturn('?sumup-charge=c1&table=t5&smp-status=success&smp-tx-code=TX')).toEqual({ chargeId: 'c1', tableId: 't5', status: 'success' })
    expect(sumupAppReturn('?tafel=abc')).toBeNull()
  })
})
