// The pickup screen (ROADMAP.md §5): a station's order numbers for guests,
// in three columns — received, being prepared, ready — read-only, live
// through the notification socket. A device paired as one, or the station
// screen's own second window (station.html?view=pickup).
import { test as base, expect, type BrowserContext, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

interface Order {
  number: number
  status: 'ordered' | 'in_progress' | 'ready'
  mode?: string | null
  updatedAt: string
}

class FakePickup {
  view: 'pickup' | null = 'pickup'
  orders: Order[] = [
    { number: 12, status: 'ordered', updatedAt: new Date().toISOString() },
    { number: 9, status: 'in_progress', mode: 'Take away', updatedAt: new Date().toISOString() },
    { number: 5, status: 'ready', updatedAt: new Date().toISOString() },
  ]
  calls = 0
  ticketCalls = 0
}

const test = base.extend<{ fake: FakePickup; push: (msg: Record<string, unknown>) => void; stubbed: BrowserContext }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakePickup()),
  // For the whole browser: the station screen's second window is another page.
  push: async ({ context }, provide) => {
    const sockets: WebSocketRoute[] = []
    await context.routeWebSocket(/\/devices\/connect/, (ws) => {
      sockets.push(ws)
    })
    await provide((msg) => sockets.forEach((ws) => ws.send(JSON.stringify(msg))))
  },
  stubbed: async ({ context, fake, push }, provide) => {
    void push
    await context.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1', orgName: 'Scouts Kabouterland', name: 'Afhaal keuken' })))
    await context.route(/\/api\//, async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/devices/ws-token') return route.fulfill({ json: { token: 'tok' } })
      if (url.pathname === '/api/organizations/org-1/devices/st-1')
        return route.fulfill({ json: { terminal_id: 'st-1', org_id: 'org-1', role: 'station', station_id: 'st-keuken', station_name: 'Keuken', view: fake.view } })
      if (url.pathname === '/api/organizations/org-1/stations/st-keuken/pickup') {
        fake.calls++
        return route.fulfill({ json: { station: 'Keuken', orders: fake.orders } })
      }
      if (url.pathname === '/api/organizations/org-1/stations/st-keuken/tickets') {
        fake.ticketCalls++
        return route.fulfill({ json: [] })
      }
      return route.fulfill({ status: 404, json: { error: 'not stubbed' } })
    })
    await provide(context)
  },
})

test('a device paired as pickup screen: the numbers in three columns, nothing else', async ({ stubbed, page, fake }) => {
  void stubbed
  await page.goto('/station.html')
  await expect(page.getByTestId('pickup-station')).toHaveText('Keuken')
  await expect(page.getByTestId('pickup-received').getByTestId('pickup-number')).toHaveText(['12'])
  await expect(page.getByTestId('pickup-preparing').getByTestId('pickup-number')).toHaveText(['9Take away'])
  await expect(page.getByTestId('pickup-ready').getByTestId('pickup-number')).toHaveText(['5'])
  // Present at opening: not "new".
  await expect(page.locator('[data-new="true"]')).toHaveCount(0)
  // Read-only: no buttons, no switches — and never the tickets themselves.
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('switch')).toHaveCount(0)
  expect(fake.ticketCalls).toBe(0)
})

test('live: a push brings the new state; a number that just became ready lights up', async ({ stubbed, page, fake, push }) => {
  void stubbed
  await page.goto('/station.html')
  await expect(page.getByTestId('pickup-ready').getByTestId('pickup-number')).toHaveText(['5'])
  const before = fake.calls
  fake.orders = [
    { number: 12, status: 'in_progress', updatedAt: new Date().toISOString() },
    { number: 9, status: 'ready', mode: 'Take away', updatedAt: new Date().toISOString() },
    { number: 5, status: 'ready', updatedAt: new Date().toISOString() },
  ]
  push({ event: 'tabs_changed', tabIds: ['x'] })
  await expect(page.getByTestId('pickup-ready').getByTestId('pickup-number')).toHaveText(['5', '9Take away'])
  await expect(page.getByTestId('pickup-received').getByTestId('pickup-number')).toHaveCount(0)
  await expect(page.getByTestId('pickup-ready').locator('[data-number="9"]')).toHaveAttribute('data-new', 'true')
  await expect(page.getByTestId('pickup-ready').locator('[data-number="5"]')).not.toHaveAttribute('data-new', 'true')
  expect(fake.calls).toBe(before + 1)
})

test("from the station screen: its button opens the pickup screen of the same station in a second window", async ({ stubbed, page, fake }) => {
  void stubbed
  fake.view = null
  await page.goto('/station.html')
  await expect(page.getByTestId('station-name')).toHaveText('Keuken')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('open-pickup').click()])
  await expect(popup).toHaveURL(/\/station\.html\?view=pickup$/)
  await expect(popup.getByTestId('pickup-station')).toHaveText('Keuken')
  await expect(popup.getByTestId('pickup-ready').getByTestId('pickup-number')).toHaveText(['5'])
  // The station screen itself goes on as it was.
  await expect(page.getByTestId('column-ordered')).toBeVisible()
})
