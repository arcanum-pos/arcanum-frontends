import { describe, expect, it } from 'vitest'
import { addToDraft, draftTotalCents, FOOI_CODE, isPaymentResolved, pickerItems, DEFAULT_PRICING, readAmountCents, tabBreakdownLines, type CurrentPayment } from './lib'
import { netQuantity, tabTitle, type TabDetail, type TabLine } from './tabs-api'

const bon = { itemCode: 'bon', name: 'Bon', unitPriceCents: 100 }
const fooi = (cents: number) => ({ itemCode: FOOI_CODE, name: 'Fooi', unitPriceCents: cents })

function line(overrides: Partial<TabLine>): TabLine {
  return {
    id: 'l1',
    orderId: 'o1',
    itemCode: 'bon',
    name: 'Bon',
    unitPriceCents: 100,
    quantity: 1,
    voidsLineId: null,
    voidReason: null,
    voidedQuantity: 0,
    createdAt: '2026-09-25T10:00:00Z',
    ...overrides,
  }
}

function tab(lines: TabLine[]): TabDetail {
  return {
    id: 't1',
    number: 7,
    label: 'Tafel 4',
    status: 'open',
    openedDeviceName: null,
    openedAt: '2026-09-25T10:00:00Z',
    receiptNumber: null,
    totalCents: 0,
    paidCents: 0,
    outstandingCents: 0,
    paymentPending: false,
    lines,
  }
}

describe('pickerItems', () => {
  it('uses the legacy items JSON keys as item codes', () => {
    // The backend derives transactions.items from these codes, and every
    // report reads that shape — renaming one silently breaks reports.
    expect(pickerItems(DEFAULT_PRICING).map((i) => i.itemCode)).toEqual(['bon', 'fietstocht', 'fietstochtMember', 'wandeltocht', 'wandeltochtMember'])
  })

  it('takes prices from the org pricing', () => {
    const items = pickerItems({ ...DEFAULT_PRICING, fietstochtNonMemberCents: 950 })
    expect(items.find((i) => i.itemCode === 'fietstocht')?.unitPriceCents).toBe(950)
  })
})

describe('addToDraft', () => {
  it('adds a new line', () => {
    expect(addToDraft([], bon, 10)).toEqual([{ ...bon, quantity: 10 }])
  })

  it('merges the same item at the same price by adding quantity', () => {
    expect(addToDraft([{ ...bon, quantity: 10 }], bon, 5)).toEqual([{ ...bon, quantity: 15 }])
  })

  it('keeps the same item at a different price as a separate line', () => {
    const draft = addToDraft([{ ...bon, quantity: 1 }], { ...bon, unitPriceCents: 120 }, 1)
    expect(draft).toHaveLength(2)
  })

  it('merges fooi by adding to the amount, not the quantity', () => {
    const draft = addToDraft(addToDraft([], fooi(150), 1), fooi(250), 1)
    expect(draft).toEqual([{ ...fooi(400), quantity: 1 }])
  })

  it('does not mutate the input draft', () => {
    const draft = [{ ...bon, quantity: 1 }]
    addToDraft(draft, bon, 1)
    expect(draft[0].quantity).toBe(1)
  })
})

describe('draftTotalCents', () => {
  it('sums price × quantity', () => {
    expect(draftTotalCents([{ ...bon, quantity: 10 }, { ...fooi(150), quantity: 1 }])).toBe(1150)
  })

  it('is 0 for an empty draft', () => {
    expect(draftTotalCents([])).toBe(0)
  })
})

describe('tabBreakdownLines', () => {
  it('lists net quantities and leaves out void lines and fully voided lines', () => {
    const lines = [
      line({ id: 'a', name: 'Wandeltocht', itemCode: 'wandeltocht', unitPriceCents: 600, quantity: 2, voidedQuantity: 1 }),
      line({ id: 'v', name: 'Wandeltocht', itemCode: 'wandeltocht', unitPriceCents: 600, quantity: -1, voidsLineId: 'a', voidReason: 'x' }),
      line({ id: 'b', name: 'Bon', quantity: 5, voidedQuantity: 5 }),
      line({ id: 'f', name: 'Fooi', itemCode: FOOI_CODE, unitPriceCents: 250 }),
    ]
    expect(tabBreakdownLines(tab(lines))).toEqual(['1 × Wandeltocht à € 6,00 = € 6,00', 'Fooi = € 2,50'])
  })
})

describe('readAmountCents', () => {
  it.each([
    ['2,50', 250],
    ['2.50', 250],
    ['3', 300],
  ])('reads %s as %i cents', (input, cents) => {
    expect(readAmountCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '0', '-2', '0,00'])('treats %j as no amount', (input) => {
    expect(readAmountCents(input)).toBe(0)
  })
})

describe('isPaymentResolved', () => {
  const base: CurrentPayment = { method: 'cash', status: 'AWAITING_MANUAL', amountCents: 100, breakdown: [], chargeId: 'c', tabId: 't' }

  it('is true for a confirmed manual payment and a succeeded Bancontact payment', () => {
    expect(isPaymentResolved({ ...base, status: 'RESOLVED' })).toBe(true)
    expect(isPaymentResolved({ ...base, method: 'bancontact', status: 'SUCCEEDED' })).toBe(true)
  })

  it.each(['AWAITING_MANUAL', 'PENDING', 'IDENTIFIED', 'FAILED', 'EXPIRED'])('is false for %s', (status) => {
    expect(isPaymentResolved({ ...base, status })).toBe(false)
  })
})

describe('tabTitle', () => {
  it('shows number and label', () => {
    expect(tabTitle({ number: 12, label: 'Jan' })).toBe('#12 Jan')
  })

  it('falls back to "Rekening #n" without a label', () => {
    expect(tabTitle({ number: 12, label: '' })).toBe('Rekening #12')
  })
})

describe('netQuantity', () => {
  it('subtracts what is already voided', () => {
    expect(netQuantity(line({ quantity: 3, voidedQuantity: 2 }))).toBe(1)
  })
})
