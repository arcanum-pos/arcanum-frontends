// The built files from the disk, for the self-hosted server (node.ts) —
// what Cloudflare's assets binding does: a file by its path (or `<path>.html`,
// or `<path>/index.html`), its content type, and how long it may be cached:
// /assets/* carries a hash in its name, so for good; everything else is
// checked again each time.
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Assets } from './app'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

async function isFile(file: string): Promise<boolean> {
  return (await stat(file).catch(() => null))?.isFile() ?? false
}

export function diskAssets(root: string): Assets {
  const base = path.resolve(root)
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    // Never outside the root (../, encoded or not).
    const wanted = path.resolve(base, '.' + pathname)
    if (wanted !== base && !wanted.startsWith(base + path.sep)) return new Response('Not found', { status: 404 })
    for (const file of [wanted, `${wanted}.html`, path.join(wanted, 'index.html')]) {
      if (!(await isFile(file))) continue
      const body = request.method === 'HEAD' ? null : await readFile(file)
      const hashed = pathname.startsWith('/assets/')
      return new Response(body, {
        headers: {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
        },
      })
    }
    return new Response('Not found', { status: 404 })
  }
}
