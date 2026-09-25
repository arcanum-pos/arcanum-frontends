import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page } from '@playwright/test'
import { FakeCatalogAdmin } from './fake-catalog-admin'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

// Console (admin app) E2E against the built app. The production build uses
// the /console basepath (router.tsx), which `vite preview` can't route to
// admin.html on its own — every /console/* document request is answered
// with dist/admin.html here, the way arcanum-bff serves it in production.
// Every /api call and /whoami is answered by an in-memory FakeCatalogAdmin.
type Fixtures = {
  catalogAdmin: FakeCatalogAdmin
  console: (path: string) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  // Playwright reads fixture dependencies from the destructuring pattern,
  // so an empty one is required here; the callback is named `provide`
  // (not `use`) so React's hooks lint rule doesn't mistake it for a hook.
  // eslint-disable-next-line no-empty-pattern
  catalogAdmin: async ({}, provide) => {
    await provide(new FakeCatalogAdmin())
  },

  console: async ({ page, catalogAdmin }, provide) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.route(/\/console(\/|$)/, async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback()
      await route.fulfill({ status: 200, contentType: 'text/html', body: readFileSync(path.join(DIST, 'admin.html'), 'utf8') })
    })
    await page.route(/\/(api\/|whoami)/, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const { status, body } = catalogAdmin.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })

    await provide(async (target: string) => {
      await page.goto(`/console${target}`)
      return page
    })

    expect(pageErrors, 'uncaught page errors').toEqual([])
  },
})

export { expect }
