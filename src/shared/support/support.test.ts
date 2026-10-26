import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '../../../worker/csp'
import { clip, describeTarget, pathOnly, Ring } from './recorder'
import { SUPPORT_ORIGIN, supportFrameUrl } from './support-url'

describe('the support button', () => {
  it('may frame the support form, and only that', () => {
    expect(CONTENT_SECURITY_POLICY).toContain(`frame-src ${SUPPORT_ORIGIN}`)
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/frame-src[^;]*\*/)
    expect(supportFrameUrl('fr', 'dark')).toBe('https://support.kaboutersoft.be/?embed=1&lang=fr&theme=dark')
  })

  it('keeps only the last few of everything', () => {
    const ring = new Ring<number>(3)
    for (let i = 1; i <= 5; i++) ring.push(i)
    expect(ring.list()).toEqual([3, 4, 5])
  })

  it('never sends a query string: it can hold codes and tokens', () => {
    expect(pathOnly('/callback?code=secret#x', 'https://a.example')).toBe('/callback')
    expect(pathOnly('https://a.example/api/x?token=1', 'https://a.example')).toBe('/api/x')
    expect(pathOnly('https://other.example/y?z=1', 'https://a.example')).toBe('https://other.example/y')
  })

  it('names a clicked control by its own label, short, never by what was typed', () => {
    expect(describeTarget({ tagName: 'BUTTON', text: '  Pay\n  now ' })).toBe('button: Pay now')
    expect(describeTarget({ tagName: 'A', label: 'Settings', text: 'ignored' })).toBe('a: Settings')
    expect(describeTarget({ tagName: 'INPUT', type: 'search', label: 'Search a product', text: null })).toBe('input[search]: Search a product')
    expect(describeTarget({ tagName: 'DIV' })).toBe('div')
    expect(clip('x'.repeat(50))).toHaveLength(40)
  })
})
