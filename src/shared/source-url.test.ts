import { describe, expect, it } from 'vitest'
import { DEFAULT_SOURCE_URL, pickSourceUrl, pickVersionInfo } from './source-url'

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
    expect(pickVersionInfo({ source_url: 'https://example.test/src', installer: true })).toEqual({ sourceUrl: 'https://example.test/src', installer: true })
    expect(pickVersionInfo({ installer: false })).toEqual({ sourceUrl: DEFAULT_SOURCE_URL, installer: false })
  })

  it('no installer unless /version says exactly true', () => {
    for (const body of [null, {}, { installer: 'true' }, { installer: 1 }]) {
      expect(pickVersionInfo(body)).toEqual({ sourceUrl: DEFAULT_SOURCE_URL, installer: false })
    }
  })
})
