import { describe, expect, it } from 'vitest'
import { legacyItemRows, methodLabel, periodBounds, toDateInput, vatLabel } from './reports'

// Local-time helpers, so the tests hold in any machine time zone.
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()

describe('periodBounds', () => {
  // Thursday 25 September 2026, mid-afternoon.
  const now = new Date(2026, 8, 25, 15, 30)

  it('today: midnight to the next midnight (exclusive)', () => {
    expect(periodBounds('today', now)).toEqual({ from: local(2026, 9, 25), to: local(2026, 9, 26) })
  })

  it('yesterday', () => {
    expect(periodBounds('yesterday', now)).toEqual({ from: local(2026, 9, 24), to: local(2026, 9, 25) })
  })

  it('this week starts on Monday', () => {
    expect(periodBounds('week', now)).toEqual({ from: local(2026, 9, 21), to: local(2026, 9, 28) })
  })

  it('on a Sunday, the week is the one that started six days earlier', () => {
    expect(periodBounds('week', new Date(2026, 8, 27, 12))).toEqual({ from: local(2026, 9, 21), to: local(2026, 9, 28) })
  })

  it('on a Monday, the week starts that same day', () => {
    expect(periodBounds('week', new Date(2026, 8, 21, 0, 5))).toEqual({ from: local(2026, 9, 21), to: local(2026, 9, 28) })
  })

  it('this month, also across a year end', () => {
    expect(periodBounds('month', now)).toEqual({ from: local(2026, 9, 1), to: local(2026, 10, 1) })
    expect(periodBounds('month', new Date(2026, 11, 31, 23))).toEqual({ from: local(2026, 12, 1), to: local(2027, 1, 1) })
  })

  it('custom: both chosen days in full', () => {
    expect(periodBounds('custom', now, { from: '2026-09-01', to: '2026-09-14' })).toEqual({ from: local(2026, 9, 1), to: local(2026, 9, 15) })
    expect(periodBounds('custom', now, { from: '2026-09-14', to: '2026-09-14' })).toEqual({ from: local(2026, 9, 14), to: local(2026, 9, 15) })
  })

  it('custom: null when incomplete or reversed', () => {
    expect(periodBounds('custom', now, { from: '', to: '2026-09-14' })).toBeNull()
    expect(periodBounds('custom', now, { from: '2026-09-14', to: '2026-09-01' })).toBeNull()
    expect(periodBounds('custom', now)).toBeNull()
  })
})

describe('toDateInput', () => {
  it('formats a local date for a date input', () => {
    expect(toDateInput(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('labels', () => {
  it('names payment methods in Dutch, unknown ones as-is', () => {
    expect(methodLabel('cash')).toBe('Contant')
    expect(methodLabel('bancontact')).toBe('Bancontact')
    expect(methodLabel('payconiq')).toBe('payconiq')
  })

  it('shows VAT basis points as a percentage, and a missing rate as "niet ingesteld"', () => {
    expect(vatLabel(2100)).toBe('21%')
    expect(vatLabel(600)).toBe('6%')
    expect(vatLabel(550)).toBe('5,5%')
    expect(vatLabel(0)).toBe('0%')
    expect(vatLabel(null)).toBe('niet ingesteld')
  })
})

describe('legacyItemRows', () => {
  it('maps the old kassa keys to readable labels, in a fixed order, fooi as an amount', () => {
    expect(legacyItemRows({ fooi: 350, wandeltochtMember: 2, bon: 40, fietstocht: 3 })).toEqual([
      { key: 'bon', label: 'Bonnen', value: '40' },
      { key: 'fietstocht', label: 'Fietstocht', value: '3' },
      { key: 'wandeltochtMember', label: 'Wandeltocht (lid)', value: '2' },
      { key: 'fooi', label: 'Fooi', value: '€ 3,50' },
    ])
  })

  it('shows unknown keys raw, after the known ones', () => {
    expect(legacyItemRows({ zwemtocht: 1, bon: 2 }).map((r) => [r.label, r.value])).toEqual([
      ['Bonnen', '2'],
      ['zwemtocht', '1'],
    ])
  })

  it('is empty for no items', () => {
    expect(legacyItemRows({})).toEqual([])
  })
})
