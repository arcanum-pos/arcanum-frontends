// The server in front of the built screens, on both runtimes
// (SELF_HOSTING.md): every HTML page gets the screens' Content-Security-
// Policy (csp.ts); everything else is passed on as is. On Cloudflare the
// files come from the assets binding (index.ts), self-hosted from the disk
// (node.ts, node-assets.ts).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { CONTENT_SECURITY_POLICY, PRINTING_POLICY } from './csp'
import worker from './index'
import { diskAssets } from './node-assets'

// The same few files, from each runtime's source.
const FILES: Record<string, [string, string]> = {
  '/kassa.html': ['text/html; charset=utf-8', '<html>kassa</html>'],
  '/station.html': ['text/html; charset=utf-8', '<html>station</html>'],
  '/assets/kassa-abc123.js': ['text/javascript; charset=utf-8', 'console.log(1)'],
  '/assets/index-def456.css': ['text/css; charset=utf-8', 'body{}'],
  '/favicon.svg': ['image/svg+xml', '<svg/>'],
}

const cloudflare = (): ((req: Request) => Promise<Response>) => {
  const ASSETS = {
    fetch: async (req: Request) => {
      const file = FILES[new URL(req.url).pathname]
      return file ? new Response(file[1], { headers: { 'Content-Type': file[0], 'Cache-Control': 'public' } }) : new Response('Not found', { status: 404 })
    },
  }
  return async (req) => worker.fetch(req, { ASSETS })
}

const onDisk = (): ((req: Request) => Promise<Response>) => {
  const root = mkdtempSync(path.join(tmpdir(), 'screens-'))
  mkdirSync(path.join(root, 'assets'))
  for (const [p, [, body]] of Object.entries(FILES)) writeFileSync(path.join(root, p), body)
  writeFileSync(path.join(path.dirname(root), 'secret.txt'), 'nope')
  const app = createApp(diskAssets(root))
  return async (req) => app.fetch(req)
}

for (const [where, make] of [['on Cloudflare', cloudflare], ['self-hosted', onDisk]] as const) {
  describe(`the screens ${where}`, () => {
    const get = (p: string) => make()(new Request(`http://screens${p}`))

    it('sends the policy with a page', async () => {
      const res = await get('/kassa.html')
      expect(res.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY)
      expect(await res.text()).toBe('<html>kassa</html>')
    })

    it('lets only a screen that prints connect to a printer on its network', async () => {
      expect((await get('/station.html')).headers.get('Content-Security-Policy')).toBe(PRINTING_POLICY)
      expect(PRINTING_POLICY).toContain("connect-src 'self' https:")
      expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self';")
    })

    it('leaves scripts, styles and images as they are', async () => {
      for (const p of ['/assets/kassa-abc123.js', '/assets/index-def456.css', '/favicon.svg']) {
        const res = await get(p)
        expect(res.status, p).toBe(200)
        expect(res.headers.get('Content-Type'), p).toBe(FILES[p][0])
        expect(res.headers.get('Content-Security-Policy'), p).toBeNull()
      }
    })

    it('a missing file: 404', async () => {
      expect((await get('/nope.html')).status).toBe(404)
    })
  })
}

describe('the files from the disk (self-hosted)', () => {
  const fetchFrom = onDisk()
  const get = (p: string, method = 'GET') => fetchFrom(new Request(`http://screens${p}`, { method }))

  it('hashed assets cached for good, pages checked each time', async () => {
    expect((await get('/assets/kassa-abc123.js')).headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect((await get('/kassa.html')).headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })

  it('a page without its .html, like Cloudflare', async () => {
    expect(await (await get('/kassa')).text()).toBe('<html>kassa</html>')
  })

  it('never a file outside the built screens', async () => {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt']) expect((await get(p)).status, p).toBe(404)
  })

  it('HEAD without a body; nothing else but reading', async () => {
    const head = await get('/kassa.html', 'HEAD')
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    expect((await get('/kassa.html', 'POST')).status).toBe(405)
  })
})

describe('the policy itself', () => {
  it('allows no inline or foreign script, and no framing', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*('unsafe-inline'|'unsafe-eval'|https:)/)
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain('frame-src https://support.kaboutersoft.be')
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
  })

  // Cloudflare serves an existing file without running the Worker unless
  // told otherwise — then no page would carry the policy.
  it('runs for every page on Cloudflare, not only for missing files', () => {
    const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    const runFirst = config.match(/"run_worker_first":\s*(\[[^\]]*\])/)
    expect(runFirst, 'assets.run_worker_first').not.toBeNull()
    expect(JSON.parse(runFirst![1])).toEqual(['/*', '!/assets/*'])
  })
})
