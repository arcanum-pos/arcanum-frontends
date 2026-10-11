// A station screen (device role 'station'): the tickets of its one station
// in columns, moved on with a tap; only paid orders by default; delivered
// ones only when asked; live through the notification socket (a push, then
// one fetch — never polling). DOMAIN_MODEL.md "Self-ordering and station screens".
import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

type Status = 'ordered' | 'in_progress' | 'ready' | 'delivered'
interface FakeTicket {
  id: string
  tabId: string
  status: Status
  createdAt: string
  updatedAt: string
  number: number
  label: string
  paid: boolean
  payLater?: boolean
  selfOrder: boolean
  lines: { name: string; quantity: number; voided: number; note: string | null }[]
}

class FakeStation {
  stationId: string | null = 'st-keuken'
  tickets: FakeTicket[] = [
    ticket('t1', 5, true, [{ name: 'Frieten', quantity: 2, voided: 0, note: 'zonder zout' }]),
    ticket('t2', 6, false, [{ name: 'Croque', quantity: 1, voided: 0, note: null }], true),
    ticket('t3', 4, true, [{ name: 'Soep', quantity: 3, voided: 1, note: null }]),
    // On a tab paid when the guest leaves: made unpaid.
    { ...ticket('t4', 8, false, [{ name: 'Croque', quantity: 2, voided: 0, note: null }], true), payLater: true },
  ]
  listCalls: string[] = []
  moves: { id: string; status: string }[] = []
}

function ticket(id: string, number: number, paid: boolean, lines: FakeTicket['lines'], selfOrder = false): FakeTicket {
  const at = new Date(Date.now() - 4 * 60_000).toISOString()
  return { id, tabId: `tab-${id}`, status: 'ordered', createdAt: at, updatedAt: at, number, label: '', paid, selfOrder, lines }
}

const test = base.extend<{ fake: FakeStation; push: (msg: Record<string, unknown>) => void; station: Page }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakeStation()),
  push: async ({ page }, provide) => {
    const sockets: WebSocketRoute[] = []
    await page.routeWebSocket(/\/devices\/connect/, (ws) => {
      sockets.push(ws)
    })
    await provide((msg) => sockets.forEach((ws) => ws.send(JSON.stringify(msg))))
  },
  station: async ({ page, fake, push }, provide) => {
    void push
    await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1', orgName: 'Scouts Kabouterland', name: 'Scherm keuken' })))
    await page.route(/\/api\//, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      if (url.pathname === '/api/devices/ws-token') return route.fulfill({ json: { token: 'tok' } })
      if (url.pathname === '/api/organizations/org-1/devices/st-1')
        return route.fulfill({ json: { terminal_id: 'st-1', org_id: 'org-1', role: 'station', station_id: fake.stationId, station_name: fake.stationId ? 'Keuken' : null } })
      if (url.pathname === '/api/organizations/org-1/stations/st-keuken/tickets') {
        fake.listCalls.push(url.search)
        const withDelivered = url.searchParams.get('delivered') === '1'
        return route.fulfill({ json: fake.tickets.filter((t) => withDelivered || t.status !== 'delivered') })
      }
      const move = url.pathname.match(/^\/api\/organizations\/org-1\/tickets\/(.+)$/)
      if (move && req.method() === 'POST') {
        const { status } = req.postDataJSON()
        fake.moves.push({ id: move[1], status })
        const t = fake.tickets.find((x) => x.id === move[1])!
        t.status = status
        return route.fulfill({ json: { id: t.id, status, updatedAt: new Date().toISOString() } })
      }
      return route.fulfill({ status: 404, json: { error: 'not stubbed' } })
    })
    await page.goto('/station.html')
    await provide(page)
  },
})

const column = (page: Page, status: Status) => page.getByTestId(`column-${status}`)

test('shows its station; only paid orders by default — saying how many unpaid ones are hidden', async ({ station: page }) => {
  await expect(page.getByTestId('station-name')).toHaveText('Keuken')
  const ordered = column(page, 'ordered')
  await expect(ordered.getByTestId('ticket')).toHaveCount(3)
  // A tab's order shows even with "only paid", marked.
  await expect(ordered.locator('[data-number="8"]')).toContainText('Op rekening')
  await expect(ordered).toContainText('#5')
  await expect(ordered).toContainText('2× Frieten')
  await expect(ordered).toContainText('zonder zout')
  // A line partly voided at the kassa: what's left, and how many were voided.
  await expect(ordered).toContainText('2× Soep')
  await expect(ordered).toContainText('1 geannuleerd')
  await expect(ordered).not.toContainText('#6')
  await expect(page.getByTestId('hidden-unpaid')).toHaveText('1 onbetaalde bestelling verborgen')

  // Unpaid ones too, when asked: marked.
  await page.getByRole('switch', { name: 'Alleen betaald' }).click()
  await expect(ordered.getByTestId('ticket')).toHaveCount(4)
  const unpaid = ordered.locator('[data-number="6"]')
  await expect(unpaid).toContainText('Nog niet betaald')
  await expect(unpaid).toContainText('Zelfbestelling')
})

test('a tap moves a ticket on: start → ready → delivered; delivered ones only when asked', async ({ station: page, fake }) => {
  const five = () => page.locator('[data-testid="ticket"][data-number="5"]')
  await five().getByRole('button', { name: 'Start' }).click()
  await expect(column(page, 'in_progress').locator('[data-number="5"]')).toBeVisible()
  await five().getByRole('button', { name: 'Klaar' }).click()
  await expect(column(page, 'ready').locator('[data-number="5"]')).toBeVisible()
  await five().getByRole('button', { name: 'Afgeleverd' }).click()
  await expect(five()).toHaveCount(0)
  expect(fake.moves).toEqual([
    { id: 't1', status: 'in_progress' },
    { id: 't1', status: 'ready' },
    { id: 't1', status: 'delivered' },
  ])
  await page.getByRole('switch', { name: 'Toon afgeleverd' }).click()
  await expect(column(page, 'delivered').locator('[data-number="5"]')).toBeVisible()
  // …and back, if tapped by mistake.
  await five().getByRole('button', { name: 'Terug' }).click()
  await expect(column(page, 'ready').locator('[data-number="5"]')).toBeVisible()
})

test('live: a push makes it fetch its tickets again — no polling in between', async ({ station: page, fake, push }) => {
  await expect(column(page, 'ordered').getByTestId('ticket')).toHaveCount(3)
  await page.waitForTimeout(1500)
  const before = fake.listCalls.length
  fake.tickets.push(ticket('t9', 9, true, [{ name: 'Spaghetti', quantity: 1, voided: 0, note: null }]))
  push({ event: 'tabs_changed', tab_id: 'tab-t9' })
  await expect(column(page, 'ordered')).toContainText('#9')
  expect(fake.listCalls.length - before).toBe(1)
})

test('a screen without a station says where to choose one', async ({ page, fake }) => {
  fake.stationId = null
  await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1' })))
  await page.route(/\/api\//, (route) =>
    route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/devices/st-1') ? { terminal_id: 'st-1', role: 'station', org_id: 'org-1' } : { token: 'x' } })
  )
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  await page.goto('/station.html')
  await expect(page.getByTestId('no-station')).toContainText('Kies er een in de console')
})
