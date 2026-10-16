// The screens on Cloudflare (wrangler.jsonc's main): the files from the
// assets binding, through the shared app (app.ts). Self-hosted: node.ts.
import { createApp } from './app'

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

export default {
  fetch(request: Request, env: { ASSETS: AssetsBinding }): Response | Promise<Response> {
    return createApp((req) => env.ASSETS.fetch(req)).fetch(request)
  },
}
