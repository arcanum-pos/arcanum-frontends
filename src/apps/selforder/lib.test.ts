import { describe, expect, it } from 'vitest'
import { cartLines, cartTotals, changeQuantity, newlyReady, route, type FollowStatus, type Menu } from './lib'

const menu: Menu = {
  eventName: 'Fuif',
  orgName: 'Scouts',
  locale: 'nl',
  open: true,
  catalog: { id: 'c', sections: [{ id: 's', name: 'Drank', entries: [{ variantId: 'a', name: 'Pils', priceCents: 250 }, { variantId: 'b', name: 'Cola', priceCents: 200 }] }] },
}

const status = (stations: FollowStatus['stations']): FollowStatus => ({
  number: 5, eventName: 'Fuif', orgName: 'Scouts', locale: 'nl', selfOrder: true, state: 'preparing', stations, lines: [], totalCents: 0, selfOrderCode: 'x', hubTicket: 't',
})

describe('self-order pages', () => {
  it('know where they are from the address', () => {
    expect(route('/bestel/abc_DEF-123')).toEqual({ kind: 'order', code: 'abc_DEF-123' })
    expect(route('/volg/tok-en_1')).toEqual({ kind: 'follow', token: 'tok-en_1' })
    expect(route('/bestel/')).toBeNull()
    expect(route('/elders')).toBeNull()
  })

  it('keep a cart within the limits, priced from the menu', () => {
    let cart = changeQuantity({}, 'a', 1)
    cart = changeQuantity(cart, 'a', 1)
    cart = changeQuantity(cart, 'b', 1)
    cart = changeQuantity(cart, 'gone', 1)
    expect(cartLines(cart, menu)).toEqual([
      { variantId: 'a', name: 'Pils', priceCents: 250, quantity: 2 },
      { variantId: 'b', name: 'Cola', priceCents: 200, quantity: 1 },
    ])
    expect(cartTotals(cartLines(cart, menu))).toEqual({ count: 3, cents: 700 })
    expect(changeQuantity(cart, 'b', -1)).toEqual({ a: 2, gone: 1 })
    expect(changeQuantity({ a: 20 }, 'a', 1)).toEqual({ a: 20 })
  })

  it('signal once per station that becomes ready', () => {
    const before = status([{ name: 'Bar', status: 'in_progress' }, { name: 'Keuken', status: 'ordered' }])
    const barReady = status([{ name: 'Bar', status: 'ready' }, { name: 'Keuken', status: 'ordered' }])
    expect(newlyReady(before, barReady)).toBe(true)
    expect(newlyReady(barReady, barReady)).toBe(false)
    expect(newlyReady(barReady, status([{ name: 'Bar', status: 'ready' }, { name: 'Keuken', status: 'ready' }]))).toBe(true)
  })
})
