import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// The website's screenshots (npm run screenshots): every screen with sample
// data from the e2e fakes, in Dutch, French and English, written to the
// website's public/screenshots (arcanum-bootstrapper, next to this repo) —
// or SHOTS_DIR. Not part of the test suite.
export default defineConfig({
  ...base,
  testDir: './screenshots',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { ...base.use, viewport: { width: 1280, height: 800 }, colorScheme: 'light', trace: 'off' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
