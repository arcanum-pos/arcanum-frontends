import { describe, expect, it } from 'vitest'
import en from './messages/en'
import m from './messages/nl'
import { filterOverview, overviewTotals, startOfDay, tabStatusKind } from './overview'
import type { TabSummary } from './tabs-api'

function tab(over: Partial<TabSummary>): TabSummary {
  return {
    id: over.id ?? `t${over.number ?? 1}`,
    number: 1,
    label: '',
    status: 'open',
    openedDeviceName: 'Kassa 1',
    openedAt: '2026-09-27T10:00:00.000Z',
    receiptNumber: null,
    totalCents: 0,
    paidCents: 0,
    outstandingCents: 0,
    paymentPending: false,
    ...over,
  }
}

const tabs = [
  tab({ number: 1, label: 'Toog', status: 'closed', totalCents: 1000, paidCents: 1000, openedDeviceName: 'Kassa 1' }),
  tab({ number: 2, label: 'Tafel 4', status: 'open', totalCents: 4150, outstandingCents: 4150, openedDeviceName: 'Kassa 2' }),
  tab({ number: 3, label: 'Tafel 7', status: 'open', paymentPending: true, totalCents: 2000, paidCents: 500, outstandingCents: 1500 }),
  tab({ number: 4, label: 'Jan', status: 'cancelled', openedDeviceName: 'Kassa 2' }),
]

describe('startOfDay', () => {
  it('is local midnight of that day', () => {
    const at = new Date(2026, 8, 27, 18, 45)
    expect(new Date(startOfDay(at)).getTime()).toBe(new Date(2026, 8, 27, 0, 0, 0, 0).getTime())
  })
})

describe('tabStatusKind', () => {
  it('open, paying, paid or cancelled', () => {
    expect(tabs.map(tabStatusKind)).toEqual(['paid', 'open', 'paying', 'cancelled'])
  })
})

describe('filterOverview', () => {
  const numbers = (list: TabSummary[]) => list.map((t) => t.number)

  it('filters by status — "open" includes a payment in progress', () => {
    expect(numbers(filterOverview(m, tabs, '', 'all'))).toEqual([1, 2, 3, 4])
    expect(numbers(filterOverview(m, tabs, '', 'open'))).toEqual([2, 3])
    expect(numbers(filterOverview(m, tabs, '', 'paid'))).toEqual([1])
    expect(numbers(filterOverview(m, tabs, '', 'cancelled'))).toEqual([4])
  })

  it('searches the title as shown, the kassa and the amount', () => {
    expect(numbers(filterOverview(m, tabs, 'tafel', 'all'))).toEqual([2, 3])
    expect(numbers(filterOverview(m, tabs, '#2', 'all'))).toEqual([2])
    expect(numbers(filterOverview(m, tabs, 'kassa 2', 'all'))).toEqual([2, 4])
    expect(numbers(filterOverview(m, tabs, '41,50', 'all'))).toEqual([2])
    expect(numbers(filterOverview(m, tabs, '41.5', 'all'))).toEqual([2])
    // Just digits: an amount's start, or the rekening's number.
    expect(numbers(filterOverview(m, tabs, '4', 'all'))).toEqual([2, 4])
    // A Toog sale is found by its name in the kassa's language.
    expect(numbers(filterOverview(en, tabs, 'counter', 'all'))).toEqual([1])
  })
})

describe('overviewTotals', () => {
  it("what's paid today and what's still open", () => {
    expect(overviewTotals(tabs)).toEqual({ paidCount: 1, paidCents: 1000, openCount: 2, openCents: 5650 })
  })
})
