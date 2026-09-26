import { describe, expect, it } from 'vitest'
import { customerBill, readCustomerOrder, type CustomerOrder } from './customer-order'

const order: CustomerOrder = {
  label: 'Tafel 4',
  number: 7,
  lines: [
    { name: 'Bon', quantity: 10, unitPriceCents: 100 },
    { name: 'Fietstocht (niet-lid)', quantity: 2, unitPriceCents: 800 },
  ],
}

describe('customerBill', () => {
  it('lines with totals, item count, the tab name', () => {
    expect(customerBill(order, 2600)).toEqual({
      title: 'Tafel 4',
      lines: [
        { name: 'Bon', quantity: 10, totalCents: 1000 },
        { name: 'Fietstocht (niet-lid)', quantity: 2, totalCents: 1600 },
      ],
      itemCount: 12,
      itemsCents: 2600,
      alreadyPaidCents: 0,
      openCents: 2600,
      tipCents: 0,
      amountCents: 2600,
    })
  })

  it('the tip is on top of the items, not an earlier payment', () => {
    const bill = customerBill(order, 2850, 250)
    expect([bill.itemsCents, bill.tipCents, bill.alreadyPaidCents, bill.amountCents]).toEqual([2600, 250, 0, 2850])
  })

  it('an earlier (split) payment shows as already paid', () => {
    expect(customerBill(order, 1600).alreadyPaidCents).toBe(1000)
  })

  it('a part of an equal split is not mistaken for an earlier payment', () => {
    const bill = customerBill({ ...order, paidCents: 0 }, 867)
    expect([bill.alreadyPaidCents, bill.openCents, bill.amountCents]).toEqual([0, 2600, 867])
    const second = customerBill({ ...order, paidCents: 867 }, 867)
    expect([second.alreadyPaidCents, second.openCents]).toEqual([867, 1733])
  })

  it('no title for a Toog sale; no lines when the order is unknown', () => {
    expect(customerBill({ ...order, label: 'Toog' }, 2600).title).toBeNull()
    const none = customerBill(null, 1500, 100)
    expect([none.title, none.lines, none.alreadyPaidCents, none.amountCents]).toEqual([null, [], 0, 1500])
  })

  it('leaves out voided (zero) lines', () => {
    expect(customerBill({ ...order, lines: [...order.lines, { name: 'Weg', quantity: 0, unitPriceCents: 500 }] }, 2600).lines).toHaveLength(2)
  })
})

describe('readCustomerOrder', () => {
  it('keeps only well-formed lines and fields', () => {
    expect(readCustomerOrder({ label: 'T', number: 1, eventName: ' Fuif ', lines: [{ name: 'A', quantity: 1, unitPriceCents: 100, secret: 'x' }, { name: 5 }, null] })).toEqual({
      label: 'T',
      number: 1,
      eventName: 'Fuif',
      paidCents: null,
      paying: null,
      lines: [{ name: 'A', quantity: 1, unitPriceCents: 100 }],
    })
    expect(readCustomerOrder({ lines: [], eventName: 42 })?.eventName).toBeNull()
    expect(readCustomerOrder(null)).toBeNull()
    expect(readCustomerOrder({ lines: 'x' })).toBeNull()
  })
})

describe('readCustomerOrder, per item', () => {
  it('keeps what this payment covers', () => {
    const o = readCustomerOrder({ label: 'T', lines: [{ name: 'A', quantity: 2, unitPriceCents: 100 }], paying: [{ name: 'A', quantity: 1, unitPriceCents: 100 }, { bad: true }] })
    expect(o?.paying).toEqual([{ name: 'A', quantity: 1, unitPriceCents: 100 }])
    expect(readCustomerOrder({ lines: [], paying: [] })?.paying).toBeNull()
  })
})
