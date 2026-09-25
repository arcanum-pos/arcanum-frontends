import { describe, expect, it } from 'vitest'
import { DEFAULT_SOURCE_URL, pickRelease, pickSourceUrl, pickVersionInfo, versionLabel } from './source-url'

describe('pickSourceUrl', () => {
  it("uses the installation's SOURCE_URL from /version", () => {
    expect(pickSourceUrl({ version: 'x', source_url: 'https://github.com/example/arcanum-fork' })).toBe('https://github.com/example/arcanum-fork')
  })

  it('falls back to the upstream repos when missing or not an http(s) URL', () => {
    expect(pickSourceUrl(null)).toBe(DEFAULT_SOURCE_URL)
    expect(pickSourceUrl({ version: 'x' })).toBe(DEFAULT_SOURCE_URL)
    expect(pickSourceUrl({ source_url: 'javascript:alert(1)' })).toBe(DEFAULT_SOURCE_URL)
    expect(pickSourceUrl({ source_url: 42 })).toBe(DEFAULT_SOURCE_URL)
  })
})

describe('pickVersionInfo', () => {
  it('reads the installer flag', () => {
    expect(pickVersionInfo({ source_url: 'https://example.test/src', installer: true })).toMatchObject({ sourceUrl: 'https://example.test/src', installer: true })
    expect(pickVersionInfo({ installer: false })).toMatchObject({ sourceUrl: DEFAULT_SOURCE_URL, installer: false })
  })

  it('no installer unless /version says exactly true', () => {
    for (const body of [null, {}, { installer: 'true' }, { installer: 1 }]) {
      expect(pickVersionInfo(body)).toMatchObject({ sourceUrl: DEFAULT_SOURCE_URL, installer: false })
    }
  })
})

describe('release', () => {
  it('reads the installed release; null when deployed from main; undefined when /version gave nothing', () => {
    expect(pickRelease({ release: '0.1.4' })).toBe('0.1.4')
    expect(pickRelease({ release: null })).toBeNull()
    expect(pickRelease({ version: 'cd238aaf-dc11' })).toBeNull()
    expect(pickRelease({ release: '<script>' })).toBeNull()
    expect(pickRelease(null)).toBeUndefined()
  })

  it('labels it for the footer', () => {
    expect(versionLabel(pickVersionInfo({ release: '0.1.4' }))).toBe('Arcanum 0.1.4')
    expect(versionLabel(pickVersionInfo({ release: null }))).toBe('Arcanum main')
    expect(versionLabel(pickVersionInfo(null))).toBeNull()
  })
})
