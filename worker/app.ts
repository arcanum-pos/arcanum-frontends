// The screens' server, the same on both runtimes (SELF_HOSTING.md): the
// built files (dist/) as they are, every HTML page with the screens'
// Content-Security-Policy (csp.ts). Only where the files come from differs:
// Cloudflare's assets binding (index.ts), or the disk (node.ts).
import { Hono } from 'hono'
import { policyFor } from './csp'

export type Assets = (request: Request) => Promise<Response>

export function withPolicy(response: Response, pathname: string): Response {
  if (!(response.headers.get('Content-Type') ?? '').includes('text/html')) return response
  const page = new Response(response.body, response)
  page.headers.set('Content-Security-Policy', policyFor(pathname))
  return page
}

export function createApp(assets: Assets): Hono {
  const app = new Hono()
  app.all('*', async (c) => withPolicy(await assets(c.req.raw), new URL(c.req.url).pathname))
  return app
}
