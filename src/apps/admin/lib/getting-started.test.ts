import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeGettingStarted, gettingStartedOpen, isGettingStartedClosed, isRegisterSkipped, skipRegister } from './getting-started'

describe('"Aan de slag"', () => {
  let stored: Record<string, string> = {}
  beforeEach(() => {
    stored = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => stored[k] ?? null, setItem: (k: string, v: string) => (stored[k] = v) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows until there is a menukaart, a kassa and a kassalade - or it is closed', () => {
    expect(gettingStartedOpen(null, false)).toBe(false)
    expect(gettingStartedOpen({ menu: false, kassa: false, register: false }, false)).toBe(true)
    expect(gettingStartedOpen({ menu: true, kassa: false, register: true }, false)).toBe(true)
    expect(gettingStartedOpen({ menu: false, kassa: true, register: false }, false)).toBe(true)
    // The kassalade's step stays in view until it's done or the card is closed.
    expect(gettingStartedOpen({ menu: true, kassa: true, register: false }, false)).toBe(true)
    expect(gettingStartedOpen({ menu: true, kassa: true, register: true }, false)).toBe(false)
  })

  it('the kassalade step skipped ("Niet nodig"): done once there is a menukaart and a kassa, per organisation', () => {
    expect(gettingStartedOpen({ menu: true, kassa: true, register: false }, false, true)).toBe(false)
    expect(gettingStartedOpen({ menu: true, kassa: false, register: false }, false, true)).toBe(true)
    expect(isRegisterSkipped('org-1')).toBe(false)
    skipRegister('org-1')
    expect(isRegisterSkipped('org-1')).toBe(true)
    expect(isRegisterSkipped('org-2')).toBe(false)
    expect(isGettingStartedClosed('org-1')).toBe(false)
  })

  it('hidden stays hidden, per organisation', () => {
    expect(gettingStartedOpen({ menu: false, kassa: false, register: false }, true)).toBe(false)
    expect(isGettingStartedClosed('org-1')).toBe(false)
    closeGettingStarted('org-1')
    closeGettingStarted('org-1')
    expect(isGettingStartedClosed('org-1')).toBe(true)
    expect(isGettingStartedClosed('org-2')).toBe(false)
    expect(JSON.parse(stored['arcanum-admin-getting-started-closed'])).toEqual(['org-1'])
  })

  it('survives a broken stored value', () => {
    stored['arcanum-admin-getting-started-closed'] = '{nope'
    expect(isGettingStartedClosed('org-1')).toBe(false)
    closeGettingStarted('org-1')
    expect(isGettingStartedClosed('org-1')).toBe(true)
  })
})
