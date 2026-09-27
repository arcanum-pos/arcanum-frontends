import type { Page, WebSocketRoute } from '@playwright/test'
import { expect, test } from './fixtures'
import type { FakeBackend } from './fake-backend'

// Light / dark / system per device (arcanum-theme): picked in Instellingen,
// on the setup screens, or in the customer display's corner. The customer
// display's rust and "Bedankt!" follow it; while paying, the order list
// does and the payment panel beside it takes the opposite.

const bg = (page: Page, testId: string) => page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor)
const isDark = (color: string) => {
  const [r, g, b] = color.match(/[\d.]+/g)!.map(Number)
  // oklch() in Chromium, rgb() in WebKit: lightness first either way for greys.
  return color.startsWith('oklch') ? r < 0.5 : r + g + b < 3 * 128
}

async function openDisplay(page: Page, backend: FakeBackend) {
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/display.html?terminal=cfd-e2e')
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  return (msg: Record<string, unknown>) => sockets.forEach((ws) => ws.send(JSON.stringify(msg)))
}

for (const theme of ['light', 'dark'] as const) {
  test(`customer display, ${theme}: rust, "Bedankt!" and the order list in the theme, the payment panel in the opposite`, async ({ page, backend }) => {
    await page.addInitScript((t) => localStorage.setItem('arcanum-theme', t), theme)
    const push = await openDisplay(page, backend)
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/)

    const tab = backend.openTab('Tafel 4', [{ name: 'Pintje', unitPriceCents: 250, quantity: 2 }])
    const charge = backend.startCharge(tab.id, 'cash')
    push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
    await expect(page.getByTestId('cfd-order')).toBeVisible()
    expect(isDark(await bg(page, 'cfd-order'))).toBe(theme === 'dark')
    expect(isDark(await bg(page, 'cfd-pay'))).toBe(theme !== 'dark')

    backend.resolveCharge(charge.id, true)
    push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
    await expect(page.getByTestId('cfd-paid')).toBeVisible()
    expect(isDark(await bg(page, 'cfd-paid'))).toBe(theme === 'dark')
  })
}

test('Instellingen → Weergave: the device goes dark, the kassa too once reopened', async ({ kassa, backend }) => {
  const settings = await kassa.context().newPage()
  await settings.route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await settings.goto('/settings.html')
  await expect(settings.locator('html')).not.toHaveClass(/\bdark\b/)
  await settings.getByRole('button', { name: 'Donker' }).click()
  await expect(settings.locator('html')).toHaveClass(/\bdark\b/)

  await kassa.reload()
  await expect(kassa.locator('html')).toHaveClass(/\bdark\b/)
})

test.describe('system theme on a dark device', () => {
  test.use({ colorScheme: 'dark' })

  test("follows the device's own setting until one is picked", async ({ page }) => {
    await page.goto('/login-prompt.html')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await page.getByRole('button', { name: 'Licht' }).click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  })
})
