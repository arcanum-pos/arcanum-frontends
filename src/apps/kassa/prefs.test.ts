import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, groupColor, readPrefs, writePrefs } from './prefs'

describe('kassa prefs', () => {
  // A browser's storage and events, enough for these.
  let stored: Record<string, string>
  beforeEach(() => {
    stored = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => stored[k] ?? null, setItem: (k: string, v: string) => (stored[k] = v), removeItem: (k: string) => delete stored[k] })
    vi.stubGlobal('window', { dispatchEvent: () => true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('nothing stored: the defaults (compact tiles, ticket right, counts and tip buttons on)', () => {
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
    expect(DEFAULT_PREFS.tiles).toBe('compact')
  })

  it('kept on the device, and read back', () => {
    writePrefs({ ...DEFAULT_PREFS, tiles: 'list', side: 'left', counts: false })
    expect(readPrefs()).toEqual({ ...DEFAULT_PREFS, tiles: 'list', side: 'left', counts: false })
    writePrefs(null)
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('anything unknown or broken falls back to the default, value by value', () => {
    localStorage.setItem('arcanum-kassa-prefs', JSON.stringify({ tiles: 'huge', side: 'left', counts: 'yes', text: 'large' }))
    expect(readPrefs()).toEqual({ ...DEFAULT_PREFS, side: 'left', text: 'large' })
    localStorage.setItem('arcanum-kassa-prefs', '{not json')
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
  })
})

describe('group colours', () => {
  it('one per place in the menu, repeating after the palette', () => {
    expect(groupColor(0)).not.toBe(groupColor(1))
    expect(groupColor(8)).toBe(groupColor(0))
    // A group not found (-1) still gets a colour.
    expect(groupColor(-1)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('dark enough for white text on it (WCAG AA, 4.5:1)', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    for (let i = 0; i < 8; i++) expect(1.05 / (luminance(groupColor(i)) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
})
