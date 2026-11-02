import { describe, expect, it } from 'vitest'
import { noteOwnChange, onlyOwnChanges, OWN_CHANGE_MS } from './tabs-api'

// devicehub's tabs_changed comes back to the kassa that made the change:
// that echo is skipped, anything else is not.
describe('own changes', () => {
  it('a push for tabs this kassa just changed is its own echo', () => {
    noteOwnChange('t1', 1000)
    noteOwnChange('t2', 1500)
    expect(onlyOwnChanges(['t1'], 2000)).toBe(true)
    expect(onlyOwnChanges(['t1', 't2'], 2000)).toBe(true)
  })

  it('another tab in the same burst, an unknown one, or nothing named: a real change', () => {
    noteOwnChange('t3', 1000)
    expect(onlyOwnChanges(['t3', 'other'], 1200)).toBe(false)
    expect(onlyOwnChanges(['t3', '*'], 1200)).toBe(false)
    expect(onlyOwnChanges([], 1200)).toBe(false)
  })

  it('only for a few seconds', () => {
    noteOwnChange('t4', 1000)
    expect(onlyOwnChanges(['t4'], 1000 + OWN_CHANGE_MS)).toBe(true)
    expect(onlyOwnChanges(['t4'], 1001 + OWN_CHANGE_MS)).toBe(false)
  })
})
