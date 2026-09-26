import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { FakeBackend } from './fake-backend'

// Every test gets a fresh FakeBackend, a kassa page wired to it (all /api
// calls + /whoami answered in-process, the devicehub notification socket
// intercepted), and a registered POS terminal in localStorage — as if the
// chooser had already run. `push` sends a devicehub event to the page.
type Fixtures = {
  backend: FakeBackend
  kassa: Page
  push: (msg: Record<string, unknown>) => void
}

export const test = base.extend<Fixtures>({
  // Playwright reads fixture dependencies from the destructuring pattern,
  // so an empty one is required here. The callback is named `provide`, not
  // Playwright's usual `use`, so React's hooks lint rule doesn't mistake it
  // for a hook.
  // eslint-disable-next-line no-empty-pattern
  backend: async ({}, provide) => {
    await provide(new FakeBackend())
  },

  push: async ({ page }, provide) => {
    const sockets: WebSocketRoute[] = []
    // Kept open, never connected to a server — just a pipe for push().
    await page.routeWebSocket(/\/devices\/connect/, (ws) => {
      sockets.push(ws)
    })
    await provide((msg) => sockets.forEach((ws) => ws.send(JSON.stringify(msg))))
  },

  kassa: async ({ page, backend, push }, provide) => {
    void push // make sure the socket route is installed before navigation
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.addInitScript(() => {
      localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'pos-e2e', role: 'pos', orgId: 'org-e2e', orgName: 'E2E' }))
    })
    await page.route(/\/(api\/|whoami)/, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })

    await page.goto('/kassa.html')
    await expect(page.getByText('Toog — direct afrekenen')).toBeVisible()
    await provide(page)

    // An uncaught exception in the app fails the test even if every
    // assertion passed.
    expect(pageErrors, 'uncaught page errors').toEqual([])
  },
})

export { expect }

// The right-hand tab panel: the ticket, how it's paid, and its actions.
export function panel(page: Page) {
  return page.getByTestId('tab-panel')
}
