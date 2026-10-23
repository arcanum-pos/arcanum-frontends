import { describe, expect, it } from 'vitest'
import { bucketize, niceTicks, stepFor } from './report-buckets'

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi)
const pay = (date: Date, method: string, amountCents: number) => ({ completedAt: date.toISOString(), method, amountCents })

describe('stepFor', () => {
  it('a day in quarters, two or three days per hour, longer per day', () => {
    expect(stepFor(at(2026, 10, 24), at(2026, 10, 25))).toBe('quarter')
    expect(stepFor(at(2026, 9, 12), at(2026, 9, 14))).toBe('hour')
    expect(stepFor(at(2026, 9, 11), at(2026, 9, 14))).toBe('hour')
    expect(stepFor(at(2026, 9, 10), at(2026, 9, 14))).toBe('day')
    expect(stepFor(at(2026, 10, 20), at(2026, 10, 27))).toBe('day')
  })
})

describe('bucketize', () => {
  it('a day: quarters from the first payment\'s hour to the end of the last one\'s, per method', () => {
    const buckets = bucketize([pay(at(2026, 10, 24, 19, 5), 'cash', 500), pay(at(2026, 10, 24, 19, 10), 'bancontact', 1200), pay(at(2026, 10, 24, 20, 40), 'cash', 300)], at(2026, 10, 24), at(2026, 10, 25))
    expect(buckets).toHaveLength(8) // 19:00 – 21:00
    expect(buckets[0].start).toEqual(at(2026, 10, 24, 19))
    expect(buckets[0].byMethod).toEqual({ cash: { count: 1, amountCents: 500 }, bancontact: { count: 1, amountCents: 1200 } })
    expect(buckets[6].byMethod).toEqual({ cash: { count: 1, amountCents: 300 } })
    expect(buckets[7].byMethod).toEqual({})
  })
  it('two days: hours from the first payment\'s to the end of the last one\'s', () => {
    const buckets = bucketize([pay(at(2026, 9, 12, 14, 30), 'cash', 500), pay(at(2026, 9, 13, 1, 10), 'sumup', 700)], at(2026, 9, 12), at(2026, 9, 14))
    expect(buckets).toHaveLength(12) // 14:00 – 02:00
    expect(buckets[0].byMethod).toEqual({ cash: { count: 1, amountCents: 500 } })
    expect(buckets[11].start).toEqual(at(2026, 9, 13, 1))
    expect(buckets[11].byMethod).toEqual({ sumup: { count: 1, amountCents: 700 } })
  })
  it('a day without payments: nothing to draw', () => {
    expect(bucketize([], at(2026, 10, 24), at(2026, 10, 25))).toEqual([])
  })
  it('a week: one bar a day, empty days included; outside the period left out', () => {
    const buckets = bucketize([pay(at(2026, 10, 21, 12), 'sumup', 800), pay(at(2026, 10, 21, 22), 'sumup', 200), pay(at(2026, 10, 28, 1), 'cash', 100)], at(2026, 10, 20), at(2026, 10, 27))
    expect(buckets).toHaveLength(7)
    expect(buckets[1].byMethod).toEqual({ sumup: { count: 2, amountCents: 1000 } })
    expect(buckets.filter((b) => Object.keys(b.byMethod).length).length).toBe(1)
  })
})

describe('niceTicks', () => {
  it('round steps up to just above the top', () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(130)).toEqual([0, 50, 100, 150])
    expect(niceTicks(0)).toEqual([0, 1])
  })
})
