// The screens self-hosted (SELF_HOSTING.md): the same app as on Cloudflare
// (app.ts), the files from the disk. Settings from the environment:
//   DIST  the built screens (default: ./dist)
//   PORT  to listen on (default 8080)
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { diskAssets } from './node-assets'

const port = Number(process.env.PORT || 8080)
const root = process.env.DIST || 'dist'
serve({ fetch: createApp(diskAssets(root)).fetch, port }, () => console.log(`arcanum-frontends serving ${root} on :${port}`))
