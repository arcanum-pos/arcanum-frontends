import { defineConfig } from '@playwright/test'

const PORT = 4174

// Kassa E2E against the built app with an in-memory fake backend (see
// e2e/fake-backend.ts) — no Worker, D1 or login needed. `vite preview`
// serves dist/; every /api call is answered inside the browser by
// page.route before it would reach the preview server's proxy.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/kassa.html`,
    // Always a fresh build — a reused server could be serving a stale dist/.
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
