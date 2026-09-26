import { expect, panel, test } from './fixtures'
import type { Page, WebSocketRoute } from '@playwright/test'
import type { FakeBackend } from './fake-backend'

// Events are an optional reporting tag (DOMAIN_MODEL.md decision 1): chosen
// per kassa in Instellingen, shown in the kassa header and on the CFD, and
// sent with every new rekening (the backend carries it onto the sales).

const FIETSTOCHT = { id: 'ev-fiets', name: 'Fietstocht 2026', date: '2026-10-04' }

async function payToog(kassa: Page) {
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: 'Volgende klant' }).click()
}

async function chooseInSettings(kassa: Page, backend: FakeBackend, name: string) {
  const settings = await kassa.context().newPage()
  await settings.route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await settings.goto('/settings.html')
  await settings.getByRole('button', { name }).click()
  return settings
}

test('no event: nothing in the header, rekeningen untagged', async ({ kassa, backend }) => {
  await expect(kassa.getByTestId('kassa-event')).toHaveCount(0)
  await payToog(kassa)
  expect(backend.tabs[0].eventId).toBeNull()
})

test('an event chosen in Instellingen: shown in the header, and every new rekening carries it', async ({ kassa, backend }) => {
  backend.events = [FIETSTOCHT, { id: 'ev-fuif', name: 'Fuif', date: '2026-11-01' }]
  const settings = await chooseInSettings(kassa, backend, 'Kies Fietstocht 2026')
  await expect(settings.getByText('Actief: Fietstocht 2026')).toBeVisible()

  await kassa.bringToFront()
  await kassa.evaluate(() => window.dispatchEvent(new Event('focus'))) // back to the kassa window
  await expect(kassa.getByTestId('kassa-event')).toHaveText('Fietstocht 2026')

  await payToog(kassa)
  await kassa.getByRole('button', { name: '+ Nieuwe rekening', exact: true }).click()
  await kassa.getByLabel('Naam of tafel').fill('Tafel 2')
  await kassa.getByRole('button', { name: 'Rekening openen', exact: true }).click()
  await expect(panel(kassa).getByRole('heading', { name: /Tafel 2/ })).toBeVisible()
  expect(backend.tabs.map((t) => t.eventId)).toEqual(['ev-fiets', 'ev-fiets'])

  // "Geen evenement" again: new rekeningen are untagged, open ones keep theirs.
  await settings.getByRole('button', { name: 'Kies geen evenement' }).click()
  await expect(settings.getByText(/^Geen evenement — /)).toBeVisible()
  await kassa.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(kassa.getByTestId('kassa-event')).toHaveCount(0)
  await kassa.getByRole('button', { name: /^Toog/ }).click()
  await payToog(kassa)
  expect(backend.tabs.map((t) => t.eventId)).toEqual(['ev-fiets', 'ev-fiets', null])
})

test('an event that no longer exists is dropped, with a notice', async ({ kassa, backend }) => {
  await kassa.evaluate((e) => localStorage.setItem('arcanum-event', JSON.stringify(e)), FIETSTOCHT)
  await kassa.reload()
  await expect(kassa.getByText('Het gekozen evenement "Fietstocht 2026" bestaat niet meer — verkopen worden niet meer aan een evenement gekoppeld.')).toBeVisible()
  await expect(kassa.getByTestId('kassa-event')).toHaveCount(0)
  await payToog(kassa)
  expect(backend.tabs[0].eventId).toBeNull()
  expect(await kassa.evaluate(() => localStorage.getItem('arcanum-event'))).toBeNull()
})

test('the CFD shows the event: when idle, while paying and on "Bedankt!"', async ({ kassa, backend }) => {
  backend.events = [FIETSTOCHT]
  await kassa.evaluate((e) => localStorage.setItem('arcanum-event', JSON.stringify(e)), FIETSTOCHT)
  await kassa.reload()
  await expect(kassa.getByTestId('kassa-event')).toHaveText('Fietstocht 2026')

  const display = await kassa.context().newPage()
  const sockets: WebSocketRoute[] = []
  await display.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await display.route(/\/(api\/|whoami)/, async (route) => {
    const url = new URL(route.request().url())
    const { status, body } = backend.handle(route.request().method(), url.pathname + url.search, null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await display.goto('/display.html?terminal=cfd-e2e')
  await expect(display.getByTestId('cfd-event')).toHaveText('Fietstocht 2026') // idle, from the kassa

  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  await expect(display.getByTestId('cfd-waiting').getByTestId('cfd-event')).toHaveText('Fietstocht 2026')
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await expect(display.getByTestId('cfd-paid').getByTestId('cfd-event')).toHaveText('Fietstocht 2026')
})

test('a CFD on another device learns the event from the payment', async ({ page, backend }) => {
  backend.events = [FIETSTOCHT]
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.route(/\/(api\/|whoami)/, async (route) => {
    const url = new URL(route.request().url())
    const { status, body } = backend.handle(route.request().method(), url.pathname + url.search, null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/display.html?terminal=cfd-e2e')
  await expect(page.getByText('Klaar voor de volgende betaling')).toBeVisible()
  await expect(page.getByTestId('cfd-event')).toHaveCount(0)

  const tab = backend.openTab('Tafel 4', [{ name: 'Pintje', unitPriceCents: 250, quantity: 2 }])
  tab.eventId = FIETSTOCHT.id
  const charge = backend.startCharge(tab.id, 'cash')
  const push = (m: object) => sockets.forEach((ws) => ws.send(JSON.stringify(m)))
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  await expect(page.getByTestId('cfd-waiting').getByTestId('cfd-event')).toHaveText('Fietstocht 2026')

  backend.resolveCharge(charge.id, true)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  push({ event: 'reset' })
  await expect(page.getByTestId('cfd-event')).toHaveText('Fietstocht 2026') // remembered when idle again
})
