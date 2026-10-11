import { describe, expect, it } from 'vitest'
import { bancontactTarget, cartLines, cartTotals, changeQuantity, modeFromSearch, newlyReady, pickMode, route, type FollowStatus, type Menu, type MenuCatalog } from './lib'

const catalog: MenuCatalog = { id: 'c', sections: [{ id: 's', name: 'Drank', entries: [{ variantId: 'a', name: 'Pils', priceCents: 250 }, { variantId: 'b', name: 'Cola', priceCents: 200 }] }] }
const mode = (id: string, name: string) => ({ id, name, payment: { counter: true, bancontact: false }, catalog })
const menu = (modes: ReturnType<typeof mode>[]): Menu => ({ eventName: 'Fuif', orgName: 'Scouts', locale: 'nl', open: true, modes })

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

  it('pick the ordering mode: the one chosen, or the only one there is', () => {
    const one = menu([mode('m1', 'Ter plaatse')])
    const two = menu([mode('m1', 'Ter plaatse'), mode('m2', 'Take away')])
    expect(pickMode(one, null)?.id).toBe('m1')
    expect(pickMode(two, null)).toBeNull()
    expect(pickMode(two, 'm2')?.name).toBe('Take away')
    expect(pickMode(two, 'gone')).toBeNull()
    // A direct link's short id: the mode it starts.
    const long = menu([mode('d097c0096f124485b66aaaaaaaaaaaaa', 'Take away'), mode('a1b2c3d4e5f6', 'Ter plaatse')])
    expect(pickMode(long, 'd097c009')?.name).toBe('Take away')
    expect(pickMode(long, 'd09')).toBeNull()
    expect(modeFromSearch('?m=abc123')).toBe('abc123')
    expect(modeFromSearch('?m=<script>')).toBeNull()
    expect(modeFromSearch('')).toBeNull()
  })

  it('keep a cart within the limits, priced from the menu', () => {
    let cart = changeQuantity({}, 'a', 1)
    cart = changeQuantity(cart, 'a', 1)
    cart = changeQuantity(cart, 'b', 1)
    cart = changeQuantity(cart, 'gone', 1)
    expect(cartLines(cart, catalog)).toEqual([
      { variantId: 'a', name: 'Pils', priceCents: 250, quantity: 2 },
      { variantId: 'b', name: 'Cola', priceCents: 200, quantity: 1 },
    ])
    expect(cartTotals(cartLines(cart, catalog))).toEqual({ count: 3, cents: 700 })
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

  it('open the Bancontact app on a phone, its checkout page on a computer', () => {
    const links = { deeplinkUrl: 'https://deeplink.test/1', checkoutUrl: 'https://checkout.test/1', qrCodeUrl: null }
    expect(bancontactTarget(links, true)).toBe('https://deeplink.test/1')
    expect(bancontactTarget(links, false)).toBe('https://checkout.test/1')
    expect(bancontactTarget({ ...links, deeplinkUrl: null }, true)).toBe('https://checkout.test/1')
  })
})
