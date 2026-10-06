// The Worker in front of the built screens: every HTML page gets the
// screens' Content-Security-Policy (worker/csp.ts); everything else is passed on as is.
import { describe, expect, it } from 'vitest'
import worker from './index'
import { CONTENT_SECURITY_POLICY } from './csp'

const assets = (type: string) => ({ fetch: async () => new Response('x', { headers: { 'Content-Type': type, 'Cache-Control': 'public' } }) })

describe('the screens Worker', () => {
  it('sends the policy with a page', async () => {
    const res = await worker.fetch(new Request('http://pages-worker/kassa.html'), { ASSETS: assets('text/html; charset=utf-8') })
    expect(res.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY)
    expect(res.headers.get('Cache-Control')).toBe('public')
  })

  it('leaves scripts, styles and images as they are', async () => {
    for (const type of ['text/javascript', 'text/css', 'image/png']) {
      const res = await worker.fetch(new Request('http://pages-worker/assets/x'), { ASSETS: assets(type) })
      expect(res.headers.get('Content-Security-Policy'), type).toBeNull()
    }
  })

  it('allows no inline or foreign script, and no framing', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*('unsafe-inline'|'unsafe-eval'|https:)/)
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
  })
})
