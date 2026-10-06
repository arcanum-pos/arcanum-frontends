// A browser that isn't a paired device can't become one by opening a
// device page directly: kassa.html, its Instellingen and display.html send
// it to the start page (root `/`), where a device is paired with a code
// from the console — nothing is registered on the way.
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { guardCsp } from './csp-guard'

test.beforeEach(async ({ context }) => {
  guardCsp(context)
})

const START = (url: URL) => url.pathname === '/'

// Every call answered as a signed-in member would get it; what reaches the backend is recorded.
async function signedIn(page: Page) {
  const calls: string[] = []
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  await page.route(/\/(api\/|whoami)/, (route) => {
    const url = new URL(route.request().url())
    calls.push(`${route.request().method()} ${url.pathname}`)
    if (url.pathname === '/whoami') return route.fulfill({ json: { name: 'Jan', email: 'jan@example.test' } })
    if (/\/devices\/[^/]+$/.test(url.pathname)) return route.fulfill({ status: 404, json: { error: 'x', code: 'device_not_found' } })
    return route.fulfill({ json: [] })
  })
  await page.route(/\/$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>start</p>' }))
  return calls
}

for (const path of ['/kassa.html', '/settings.html', '/display.html']) {
  test(`${path} on a browser that was never paired: to the start page, nothing registered`, async ({ page }) => {
    const calls = await signedIn(page)
    await page.goto(path)
    await page.waitForURL(START)
    expect(calls.filter((c) => c.startsWith('POST') && /devices|pairings|register/.test(c))).toEqual([])
  })
}

test("a paired customer display that opens kassa.html: to the start page (which opens the display)", async ({ page }) => {
  await signedIn(page)
  await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'cfd-1', role: 'cfd', orgId: 'org-1' })))
  await page.goto('/kassa.html')
  await page.waitForURL(START)
})

test('a kassa removed in the console: to the start page, and the browser forgets it', async ({ page }) => {
  await signedIn(page)
  await page.goto('/chooser.html') // any page of this origin, to set storage once (no init script: it would put it back)
  await page.evaluate(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'pos-gone', role: 'pos', orgId: 'org-1' })))
  await page.goto('/kassa.html')
  await page.waitForURL(START)
  expect(await page.evaluate(() => localStorage.getItem('arcanum-terminal'))).toBeNull()
})

test("display.html?terminal=… (the kassa's own second window) is used as is — no pairing needed", async ({ page }) => {
  await signedIn(page)
  await page.goto('/display.html?terminal=display-of-pos-1')
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/display.html')
})
