import { describe, expect, it } from 'vitest'
import { readBranding, textOn } from './branding'

describe('readBranding', () => {
  it('keeps only #rrggbb colours and a logo on its own route', () => {
    expect(readBranding({ primary: '#1F6B3A', accent: 'red', logoUrl: '/api/public/branding/org-1/logo.png?v=2026' })).toEqual({
      primary: '#1f6b3a',
      accent: null,
      logoUrl: '/api/public/branding/org-1/logo.png?v=2026',
    })
    expect(readBranding({ logoUrl: 'https://evil.test/logo.png' }).logoUrl).toBeNull()
    expect(readBranding({ logoUrl: 'javascript:alert(1)' }).logoUrl).toBeNull()
    expect(readBranding(null)).toEqual({ primary: null, accent: null, logoUrl: null })
  })
})

describe('textOn', () => {
  it('white on dark colours, near-black on light ones', () => {
    expect(textOn('#1f6b3a')).toBe('#ffffff') // scouts green
    expect(textOn('#c8102e')).toBe('#ffffff') // club red
    expect(textOn('#f2c500')).toBe('#0a0a0a') // a yellow scarf
    expect(textOn('#ffffff')).toBe('#0a0a0a')
    expect(textOn('#000000')).toBe('#ffffff')
  })
})
