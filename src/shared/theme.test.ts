import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, storedTheme, storeTheme } from './theme'

function stubBrowser(stored: Record<string, string>, prefersDark: boolean) {
  const classes = new Set<string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => stored[k] ?? null, setItem: (k: string, v: string) => (stored[k] = v) })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: prefersDark }) })
  vi.stubGlobal('document', { documentElement: { classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } } })
  return classes
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme', () => {
  it("is 'system' until one is picked, and ignores anything else stored", () => {
    stubBrowser({}, false)
    expect(storedTheme('arcanum-theme')).toBe('system')
    stubBrowser({ 'arcanum-theme': 'purple' }, false)
    expect(storedTheme('arcanum-theme')).toBe('system')
  })

  it('keeps the device and the console apart', () => {
    const stored: Record<string, string> = {}
    stubBrowser(stored, false)
    storeTheme('arcanum-theme', 'dark')
    expect(storedTheme('arcanum-theme')).toBe('dark')
    expect(storedTheme('arcanum-admin-theme')).toBe('system')
  })

  it('dark, light, or the system preference', () => {
    let classes = stubBrowser({}, true)
    applyTheme('system')
    expect(classes.has('dark')).toBe(true)
    applyTheme('light')
    expect(classes.has('dark')).toBe(false)
    classes = stubBrowser({}, false)
    applyTheme('system')
    expect(classes.has('dark')).toBe(false)
    applyTheme('dark')
    expect(classes.has('dark')).toBe(true)
  })

  it('blocked storage: nothing remembered, nothing thrown', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(() => storeTheme('arcanum-theme', 'dark')).not.toThrow()
    expect(storedTheme('arcanum-theme')).toBe('system')
  })
})
