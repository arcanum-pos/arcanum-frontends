import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// One HTML entry per screen/app — each becomes its own independently
// bundled React root, so e.g. a kassa build never pulls in admin-only
// code (Rollup only includes what that entry's own source actually
// imports; src/shared/ui is only bundled into whichever entries use it).
// To add a new screen: add its name here, create <name>.html at the repo
// root (copy admin.html as a starting point), and add src/apps/<name>/.
const APPS = ['admin', 'login-prompt', 'device', 'chooser', 'simulator', 'display', 'kassa', 'settings', 'transactions'] as const

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(APPS.map((name) => [name, path.resolve(__dirname, `${name}.html`)])),
    },
  },
  server: {
    // Vite's own hot-reload dev server (npm run dev) — separate from, and
    // not to be confused with, the 8791 in wrangler.jsonc's `dev.port`
    // (that one's for `wrangler dev`, serving the *built* dist/ through
    // the actual Worker shape; also what questo-bff's CONSOLE_LOCAL_URL
    // points at). Left at Vite's own default (5173).
    //
    // Forwards API calls to a real local questo-bff (see LOCAL_DEV.md at
    // the questo folder root for the full port map / setup) — lets
    // `npm run dev` exercise real data without deploying anything first.
    // Login/callback/logout/device aren't proxied: this dev server isn't
    // same-origin with questo-bff, so those flows only work for real once
    // this app is actually deployed behind it.
    proxy: {
      '/api': 'http://localhost:8787',
      '/whoami': 'http://localhost:8787',
    },
  },
})
