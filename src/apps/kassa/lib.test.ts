import { describe, expect, it } from 'vitest'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import { addToDraft, draftTotalCents, entryToPickerItem, FOOI_CODE, isPaymentResolved, readAmountCents, reconcileDrafts, tabBreakdownLines, type CurrentPayment } from './lib'
import { netQuantity, tabTitle, toLineInputs, type DraftLine, type TabDetail, type TabLine } from './tabs-api'

const bon = { itemCode: 'bon', name: 'Bon', unitPriceCents: 100 }
const fooi = (cents: number) => ({ itemCode: FOOI_CODE, name: 'Fooi', unitPriceCents: cents })

function entry(variantId: string, name: string, priceCents: number, code: string | null = null): KassaEntry {
  return { entryId: `e-${variantId}`, variantId, name, priceCents, code, categoryName: null, quickQuantities: null }
}

function catalog(id: string, entries: KassaEntry[]): KassaCatalog {
  return { id, name: id, updatedAt: '2026-09-25T10:00:00Z', sections: [{ id: 's1', name: 'Tochten', entries }] }
}

const fiets = entry('v-fiets', 'Fietstocht (niet-lid)', 800, 'fietstocht')
const fietsLid = entry('v-fiets-lid', 'Fietstocht (lid)', 500, 'fietstochtMember')

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

describe('entryToPickerItem', () => {
  it('carries the variant id and uses the variant code as item code', () => {
    // The code becomes order_lines.item_code — for the seeded legacy items
    // the transactions.items key every report still reads.
    expect(entryToPickerItem(fietsLid)).toEqual({ itemCode: 'fietstochtMember', name: 'Fietstocht (lid)', unitPriceCents: 500, variantId: 'v-fiets-lid' })
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

  it('merges catalog lines by variant, never with a free line or another variant', () => {
    let draft = addToDraft([], entryToPickerItem(fiets), 1)
    draft = addToDraft(draft, entryToPickerItem(fiets), 2)
    draft = addToDraft(draft, entryToPickerItem(fietsLid), 1)
    draft = addToDraft(draft, { itemCode: 'fietstocht', name: 'Fietstocht', unitPriceCents: 800 }, 1)
    expect(draft.map((l) => [l.variantId ?? null, l.quantity])).toEqual([
      ['v-fiets', 3],
      ['v-fiets-lid', 1],
      [null, 1],
    ])
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

describe('reconcileDrafts', () => {
  const drafts = (): Record<string, DraftLine[]> => ({
    quick: [
      { ...entryToPickerItem(fiets), quantity: 2 },
      { ...fooi(150), quantity: 1 },
    ],
    t1: [{ ...entryToPickerItem(fietsLid), quantity: 1 }],
  })

  it('updates catalog lines to the current catalog name and price', () => {
    const repriced = catalog('c1', [{ ...fiets, priceCents: 900, name: 'Fietstocht (niet-lid, 2026)' }, fietsLid])
    const { drafts: next, dropped } = reconcileDrafts(drafts(), repriced, false)
    expect(dropped).toBe(0)
    expect(next.quick[0]).toMatchObject({ variantId: 'v-fiets', quantity: 2, unitPriceCents: 900, name: 'Fietstocht (niet-lid, 2026)' })
  })

  it('keeps a vanished line when the catalog is the same one (the server refuses it, the cashier fixes it)', () => {
    const { drafts: next, dropped } = reconcileDrafts(drafts(), catalog('c1', [fiets]), false)
    expect(dropped).toBe(0)
    expect(next.t1).toHaveLength(1)
  })

  it('drops lines not on a different catalog, keeps free lines, and removes tabs left empty', () => {
    const { drafts: next, dropped } = reconcileDrafts(drafts(), catalog('c2', [fiets]), true)
    expect(dropped).toBe(1)
    expect(next.quick.map((l) => l.itemCode)).toEqual(['fietstocht', FOOI_CODE])
    expect(next.t1).toBeUndefined()
  })

  it('drops every catalog line when there is no catalog at all', () => {
    const { drafts: next, dropped } = reconcileDrafts(drafts(), null, true)
    expect(dropped).toBe(2)
    expect(next.quick.map((l) => l.itemCode)).toEqual([FOOI_CODE])
  })
})

describe('toLineInputs', () => {
  it('sends only variant + quantity for catalog lines, the full line for free lines', () => {
    expect(toLineInputs([{ ...entryToPickerItem(fiets), quantity: 2 }, { ...fooi(150), quantity: 1 }])).toEqual([
      { variantId: 'v-fiets', quantity: 2 },
      { itemCode: FOOI_CODE, name: 'Fooi', unitPriceCents: 150, quantity: 1 },
    ])
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
