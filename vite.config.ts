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
const APPS = ['admin'] as const

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
})
