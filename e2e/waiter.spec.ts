// The waiter screen (release C, DOMAIN_MODEL.md "Tables and waiters"): the
// tables by zone and status, seating guests, a round from the "aan tafel"
// menu, paying at the table (Bancontact QR, cash at the till), Opgeruimd,
// a scanned table QR; and the table QR for a guest (/tafel/<token>).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

type State = 'free' | 'occupied' | 'clearing'

class FakeRestaurant {
  tables: { id: string; name: string; zone: string | null; position: number; archived: boolean; state: State; tab: any; qrToken: string }[] = [
    { id: 't1', name: '1', zone: 'Zaal', position: 0, archived: false, state: 'free', tab: null, qrToken: 'qr-one' },
    { id: 't2', name: '2', zone: 'Zaal', position: 1, archived: false, state: 'clearing', tab: null, qrToken: 'qr-two' },
    { id: 't3', name: 'T1', zone: 'Terras', position: 2, archived: false, state: 'free', tab: null, qrToken: 'qr-three' },
  ]
  tab: any = null
  rounds: any[] = []
  payments: any[] = []
  calls: string[] = []
}

const test = base.extend<{ fake: FakeRestaurant; waiter: Page; push: () => void }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakeRestaurant()),
  push: async ({ page }, provide) => {
    const sockets: WebSocketRoute[] = []
    await page.routeWebSocket(/\/devices\/connect/, (ws) => {
      sockets.push(ws)
    })
    await provide(() => sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'tabs_changed' }))))
  },
  waiter: async ({ page, fake, push }, provide) => {
    void push
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route(/\/api\//, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const p = url.pathname
      fake.calls.push(`${req.method()} ${p}`)
      if (p === '/api/organizations/memberships') return route.fulfill({ json: [{ orgId: 'org-1', orgName: 'Scouts', role: 'waiter' }] })
      if (p === '/api/organizations/org-1/events')
        return route.fulfill({ json: [{ id: 'ev1', name: 'Restaurantdag', date: null, modes: [{ id: 'm1', name: 'Ter plaatse', catalogId: 'cat1', atTable: true }] }] })
      if (p === '/api/organizations/org-1/live-token') return route.fulfill({ json: { token: 'live' } })
      if (p === '/api/organizations/org-1/tables') return route.fulfill({ json: fake.tables })
      if (p === '/api/organizations/org-1/tables/by-qr/qr-three') return route.fulfill({ json: fake.tables[2] })
      const seat = p.match(/^\/api\/organizations\/org-1\/tables\/([^/]+)\/seat$/)
      if (seat) {
        const t = fake.tables.find((x) => x.id === seat[1])!
        fake.tab = { id: 'tab1', number: 7, label: `Tafel ${t.name}`, status: 'open', lines: [], totalCents: 0, paidCents: 0, outstandingCents: 0, paymentPending: false }
        Object.assign(t, { state: 'occupied', tab: { id: 'tab1', number: 7, label: fake.tab.label, openedAt: new Date().toISOString(), totalCents: 0 } })
        return route.fulfill({ status: 201, json: t })
      }
      const clear = p.match(/^\/api\/organizations\/org-1\/tables\/([^/]+)\/clear$/)
      if (clear) {
        const t = fake.tables.find((x) => x.id === clear[1])!
        t.state = 'free'
        return route.fulfill({ json: t })
      }
      if (p === '/api/organizations/org-1/tabs/tab1') return route.fulfill({ json: fake.tab })
      if (p === '/api/organizations/org-1/tabs/tab1/orders') {
        const body = req.postDataJSON()
        fake.rounds.push(body)
        fake.tab.lines.push({ id: 'l1', orderId: 'o1', itemCode: null, name: 'Spaghetti', unitPriceCents: 1200, quantity: 2, voidsLineId: null, voidReason: null, voidedQuantity: 0, createdAt: '' })
        Object.assign(fake.tab, { totalCents: 2400, outstandingCents: 2400 })
        return route.fulfill({ status: 201, json: fake.tab })
      }
      if (p === '/api/organizations/org-1/catalogs/cat1/kassa')
        return route.fulfill({
          json: { id: 'cat1', name: 'Restaurant', updatedAt: '', sections: [{ id: 's1', name: 'Hoofdgerechten', entries: [{ entryId: 'e1', variantId: 'v1', name: 'Spaghetti', priceCents: 1200, code: null, categoryName: null, quickQuantities: null }] }] },
        })
      if (p === '/api/bancontact/payments') {
        fake.payments.push(req.postDataJSON())
        return route.fulfill({ status: 201, json: { chargeId: 'c1', qrCodeUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', status: 'pending' } })
      }
      if (p === '/api/bancontact/sumup/readers') return route.fulfill({ json: { readers: [] } })
      return route.fulfill({ status: 404, json: { error: 'not stubbed' } })
    })
    await page.goto('/waiter.html')
    await provide(page)
  },
})

test('the tables by zone and status; seat guests, order a round, take payment', async ({ waiter: page, fake }) => {
  await expect(page.getByRole('heading', { name: 'Tafels' })).toBeVisible()
  await expect(page.getByText('Zaal')).toBeVisible()
  await expect(page.getByText('Terras')).toBeVisible()
  await expect(page.locator('[data-testid="table"][data-state="clearing"]')).toContainText('Af te ruimen')

  await page.getByTestId('table').filter({ hasText: /^1/ }).click()
  await expect(page.getByRole('heading', { name: 'Tafel 1' })).toBeVisible()
  await page.getByTestId('seat').click()
  expect(fake.calls).toContain('POST /api/organizations/org-1/tables/t1/seat')

  await page.getByTestId('order').click()
  await page.getByRole('button', { name: 'Eén Spaghetti meer' }).click()
  await page.getByRole('button', { name: 'Eén Spaghetti meer' }).click()
  await page.getByTestId('send-round').click()
  expect(fake.rounds[0]).toMatchObject({ catalogId: 'cat1', lines: [{ variantId: 'v1', quantity: 2 }] })
  await expect(page.getByTestId('tab-lines')).toContainText('2× Spaghetti')
  await expect(page.getByTestId('outstanding')).toHaveText('€ 24,00')

  await page.getByTestId('pay').click()
  await expect(page.getByTestId('cash-at-till')).toContainText('rekening "Tafel 1"')
  await page.getByRole('button', { name: /Bancontact/ }).click()
  await expect(page.getByTestId('bancontact-qr')).toBeVisible()
  expect(fake.payments[0]).toMatchObject({ orgId: 'org-1', tabId: 'tab1', amount: 2400 })
})

test('a table to clear: Opgeruimd makes it free again', async ({ waiter: page, fake }) => {
  await page.locator('[data-testid="table"][data-state="clearing"]').click()
  await page.getByTestId('cleared').click()
  await expect.poll(() => fake.tables[1].state).toBe('free')
  expect(fake.calls).toContain('POST /api/organizations/org-1/tables/t2/clear')
})

test("a scanned table QR opens that table", async ({ waiter: page }) => {
  await page.goto('/waiter.html?tafel=qr-three')
  await expect(page.getByRole('heading', { name: 'Tafel T1' })).toBeVisible()
})

test.describe('a guest scanning the table QR', () => {
  async function guest(page: Page, answer: Record<string, unknown>) {
    await page.route(/\/tafel\//, (route) =>
      route.request().resourceType() === 'document' ? route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'selforder.html'), 'utf8') }) : route.fallback()
    )
    await page.route(/\/whoami$/, (route) => route.fulfill({ status: 401, json: {} }))
    await page.route(/\/volg\//, (route) => route.fulfill({ contentType: 'text/html', body: '<p>volg</p>' }))
    await page.route(/\/api\/public\/tables\//, (route) => route.fulfill({ json: answer }))
    await page.goto('/tafel/qr-one')
  }

  test('a table nobody sits at yet: a welcome', async ({ page }) => {
    await guest(page, { table: '1', orgName: 'Scouts', occupied: false, orderToken: null })
    await expect(page.getByTestId('table-qr')).toContainText('Tafel 1')
    await expect(page.getByTestId('table-qr')).toContainText('Er komt zo iemand bij je')
  })

  test("a Bezet table whose mode allows it: on to the table's tab, to order", async ({ page }) => {
    await guest(page, { table: '1', orgName: 'Scouts', occupied: true, orderToken: 'tok-abcdefghijklmnopqrst' })
    await page.waitForURL(/\/volg\/tok-abcdefghijklmnopqrst$/)
  })
})
