import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLocale, preferredLocale, storedLocale, storeLocale } from '.'

function stubBrowser(languages: string[], stored: Record<string, string> = {}) {
  vi.stubGlobal('navigator', { languages, language: languages[0] })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      stored[k] = v
    },
  })
  return stored
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browserLocale', () => {
  it('takes the first preferred language we speak, region ignored', () => {
    stubBrowser(['de-DE', 'fr-BE', 'nl-BE'])
    expect(browserLocale()).toBe('fr')
  })

  it('is null when none is ours', () => {
    stubBrowser(['de-DE', 'es'])
    expect(browserLocale()).toBeNull()
  })
})

describe('preferredLocale', () => {
  it('a picked language beats the browser', () => {
    stubBrowser(['fr-BE'], { 'arcanum-locale': 'en' })
    expect(preferredLocale()).toBe('en')
  })

  it('falls back to the browser, then Dutch', () => {
    stubBrowser(['en-GB'])
    expect(preferredLocale()).toBe('en')
    stubBrowser(['de-DE'])
    expect(preferredLocale()).toBe('nl')
  })

  it('ignores a stored value that is not a language of ours', () => {
    stubBrowser(['de-DE'], { 'arcanum-locale': 'de' })
    expect(storedLocale()).toBeNull()
    expect(preferredLocale()).toBe('nl')
  })
})

describe('storeLocale', () => {
  it('remembers the pick', () => {
    const stored = stubBrowser(['nl-BE'])
    storeLocale('fr')
    expect(stored['arcanum-locale']).toBe('fr')
    expect(storedLocale()).toBe('fr')
  })

  it('blocked storage: nothing remembered, nothing thrown', () => {
    vi.stubGlobal('navigator', { languages: ['fr-BE'], language: 'fr-BE' })
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(() => storeLocale('en')).not.toThrow()
    expect(preferredLocale()).toBe('fr')
  })
})
