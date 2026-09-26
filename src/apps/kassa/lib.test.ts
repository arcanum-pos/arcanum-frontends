import { describe, expect, it } from 'vitest'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import {
  addToDraft,
  centsToInput,
  clampTip,
  draftTotalCents,
  entryToPickerItem,
  filterSections,
  normalizeSearch,
  searchPick,
  FOOI_CODE,
  isPaymentResolved,
  MAX_TIP_CENTS,
  readAmountCents,
  reconcileDrafts,
  roundUpTipCents,
  tabBreakdownLines,
  type CurrentPayment,
} from './lib'
import { netQuantity, tabTitle, toLineInputs, type DraftLine, type TabDetail, type TabLine } from './tabs-api'

const bon = { itemCode: 'bon', name: 'Bon', unitPriceCents: 100, variantId: 'v-bon' }

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

  it('merges the same variant by adding quantity', () => {
    expect(addToDraft([{ ...bon, quantity: 10 }], bon, 5)).toEqual([{ ...bon, quantity: 15 }])
  })

  it('keeps different variants of one product as separate lines', () => {
    let draft = addToDraft([], entryToPickerItem(fiets), 1)
    draft = addToDraft(draft, entryToPickerItem(fiets), 2)
    draft = addToDraft(draft, entryToPickerItem(fietsLid), 1)
    expect(draft.map((l) => [l.variantId, l.quantity])).toEqual([
      ['v-fiets', 3],
      ['v-fiets-lid', 1],
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
    expect(draftTotalCents([{ ...bon, quantity: 10 }, { ...entryToPickerItem(fiets), quantity: 2 }])).toBe(2600)
  })

  it('is 0 for an empty draft', () => {
    expect(draftTotalCents([])).toBe(0)
  })
})

describe('reconcileDrafts', () => {
  const drafts = (): Record<string, DraftLine[]> => ({
    quick: [
      { ...entryToPickerItem(fiets), quantity: 2 },
      { ...bon, quantity: 5 },
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

  it('drops lines not on a different catalog and removes tabs left empty', () => {
    const { drafts: next, dropped } = reconcileDrafts(drafts(), catalog('c2', [fiets]), true)
    expect(dropped).toBe(2)
    expect(next.quick.map((l) => l.itemCode)).toEqual(['fietstocht'])
    expect(next.t1).toBeUndefined()
  })

  it('drops every line when there is no catalog at all', () => {
    const { drafts: next, dropped } = reconcileDrafts(drafts(), null, true)
    expect(dropped).toBe(3)
    expect(next).toEqual({})
  })
})

describe('toLineInputs', () => {
  it('sends only variant + quantity — the server prices every line', () => {
    expect(toLineInputs([{ ...entryToPickerItem(fiets), quantity: 2 }, { ...bon, quantity: 1 }])).toEqual([
      { variantId: 'v-fiets', quantity: 2 },
      { variantId: 'v-bon', quantity: 1 },
    ])
  })
})

describe('tabBreakdownLines', () => {
  const lines = [
    line({ id: 'a', name: 'Wandeltocht', itemCode: 'wandeltocht', unitPriceCents: 600, quantity: 2, voidedQuantity: 1 }),
    line({ id: 'v', name: 'Wandeltocht', itemCode: 'wandeltocht', unitPriceCents: 600, quantity: -1, voidsLineId: 'a', voidReason: 'x' }),
    line({ id: 'b', name: 'Bon', quantity: 5, voidedQuantity: 5 }),
  ]

  it('lists net quantities and leaves out void lines and fully voided lines', () => {
    expect(tabBreakdownLines(tab(lines))).toEqual(['1 × Wandeltocht à € 6,00 = € 6,00'])
  })

  it('adds the tip of this payment as a last line', () => {
    expect(tabBreakdownLines(tab(lines), 150)).toEqual(['1 × Wandeltocht à € 6,00 = € 6,00', 'Fooi = € 1,50'])
  })

  it('still shows an old fooi line (from before 3d) as "Fooi"', () => {
    const old = [line({ id: 'f', name: 'Fooi', itemCode: FOOI_CODE, unitPriceCents: 250 })]
    expect(tabBreakdownLines(tab(old))).toEqual(['Fooi = € 2,50'])
  })
})

describe('tip helpers', () => {
  it.each([
    [1850, 50],
    [1801, 99],
    [1899, 1],
    [1800, 0],
  ])('roundUpTipCents(%i) = %i (rounds up to the next whole euro)', (amount, tip) => {
    expect(roundUpTipCents(amount)).toBe(tip)
  })

  it('clamps a tip to 0..the backend maximum', () => {
    expect(clampTip(-50)).toBe(0)
    expect(clampTip(250)).toBe(250)
    expect(clampTip(MAX_TIP_CENTS + 1)).toBe(MAX_TIP_CENTS)
  })

  it('turns cents back into the comma input, empty for no tip', () => {
    expect(centsToInput(250)).toBe('2,50')
    expect(centsToInput(100)).toBe('1,00')
    expect(centsToInput(0)).toBe('')
    expect(readAmountCents(centsToInput(1234))).toBe(1234)
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
  const base: CurrentPayment = { method: 'cash', status: 'AWAITING_MANUAL', amountCents: 100, breakdown: [], chargeId: 'c', tabId: 't', tipCents: 0 }

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

describe('product search and group filter', () => {
  const sections: KassaCatalog['sections'] = [
    { id: 's-drank', name: 'Drank', entries: [entry('v-duvel', 'Duvel', 400, 'duvel'), entry('v-pint', 'Pintje', 250, 'P1'), entry('v-cava', 'Glas cava', 450)] },
    { id: 's-menu', name: 'Menu', entries: [entry('v-steak-n', 'Steak (normaal)', 3400), entry('v-steak-k', 'Steak (kind)', 2600), entry('v-vav', 'Vol-au-vent (kind)', 2200)] },
  ]
  const names = (s: KassaCatalog['sections']) => s.flatMap((x) => x.entries.map((e) => e.name))

  it('normalizes case, accents and punctuation', () => {
    expect(normalizeSearch('  VOL-AU-VÉNT ')).toBe('vol au vent')
  })

  it('no query and no group: everything', () => {
    expect(filterSections(sections, '', null)).toEqual(sections)
    expect(filterSections(sections, '   ', null)).toEqual(sections)
  })

  it('every word must match the name or the code', () => {
    expect(names(filterSections(sections, 'steak', null))).toEqual(['Steak (normaal)', 'Steak (kind)'])
    expect(names(filterSections(sections, 'kind steak', null))).toEqual(['Steak (kind)'])
    expect(names(filterSections(sections, 'vol au vent', null))).toEqual(['Vol-au-vent (kind)'])
    expect(names(filterSections(sections, 'p1', null))).toEqual(['Pintje'])
    expect(filterSections(sections, 'pizza', null)).toEqual([])
  })

  it('a group narrows to that section, and combines with the search', () => {
    expect(names(filterSections(sections, '', 's-drank'))).toEqual(['Duvel', 'Pintje', 'Glas cava'])
    expect(names(filterSections(sections, 'kind', 's-drank'))).toEqual([])
    expect(filterSections(sections, 'kind', 's-menu').map((s) => s.id)).toEqual(['s-menu'])
  })

  it('leaves empty groups out', () => {
    expect(filterSections(sections, 'duvel', null).map((s) => s.id)).toEqual(['s-drank'])
  })

  it('Enter picks an exact code, or the only match — never a guess', () => {
    expect(searchPick(sections, 'P1')?.name).toBe('Pintje')
    expect(searchPick(sections, 'duvel')?.name).toBe('Duvel')
    expect(searchPick(sections, 'steak kind')?.name).toBe('Steak (kind)')
    expect(searchPick(sections, 'steak')).toBeNull()
    expect(searchPick(sections, '')).toBeNull()
    expect(searchPick(sections, 'pizza')).toBeNull()
  })
})
