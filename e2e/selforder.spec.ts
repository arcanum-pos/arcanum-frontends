// The self-order pages on a guest's phone (DOMAIN_MODEL.md "Self-ordering and
// station screens"): menu → cart → pay at the toog → your order, followed
// live over the order hub (a fake socket here) — never polling. On a small
// phone (360×640), without sideways scrolling.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const CODE = 'abcdefghijklmnopqrstuvwxyz012345'
const TOKEN = 'tok_abcdefghijklmnopqrstu'

type Station = { name: string; status: 'ordered' | 'in_progress' | 'ready' | 'delivered' }

class FakeSelfOrder {
  open = true
  payment = { counter: true, bancontact: false }
  // The follow page's payment block (a self-order waiting for payment).
  followPayment: { counter: boolean; bancontact: boolean; pending: boolean; failed: boolean } | null = null
  bancontactCalls = 0
  placed: any[] = []
  statusCalls = 0
  state = 'awaiting_payment'
  stations: Station[] = [{ name: 'Bar', status: 'ordered' }, { name: 'Keuken', status: 'ordered' }]
  menu() {
    return {
      eventName: 'Fuif in de Kabouterbossen',
      orgName: 'Scouts Kabouterland',
      locale: 'nl',
      open: this.open,
      payment: this.payment,
      catalog: this.open
        ? {
            id: 'c',
            sections: [
              { id: 's1', name: 'Drank', entries: [{ variantId: 'v-pils', name: 'Pils', priceCents: 250 }, { variantId: 'v-cola', name: 'Cola zonder suiker en met een heel lange naam', priceCents: 220 }] },
              { id: 's2', name: 'Eten', entries: [{ variantId: 'v-frieten', name: 'Frieten', priceCents: 400 }] },
            ],
          }
        : null,
    }
  }
  status() {
    this.statusCalls++
    return {
      number: 7,
      eventName: 'Fuif in de Kabouterbossen',
      orgName: 'Scouts Kabouterland',
      locale: 'nl',
      selfOrder: true,
      state: this.state,
      stations: this.stations,
      lines: [{ name: 'Pils', quantity: 2, unitPriceCents: 250 }, { name: 'Frieten', quantity: 1, unitPriceCents: 400 }],
      totalCents: 900,
      selfOrderCode: CODE,
      payment: this.state === 'awaiting_payment' ? this.followPayment : null,
      hubTicket: ['delivered', 'cancelled', 'nothing_to_prepare'].includes(this.state) ? null : 'ticket-7',
    }
  }
}

const test = base.extend<{ fake: FakeSelfOrder; hub: { sockets: WebSocketRoute[]; push: () => void }; phone: Page }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakeSelfOrder()),
  hub: async ({ page }, provide) => {
    const sockets: WebSocketRoute[] = []
    await page.routeWebSocket(/\/orders\/connect/, (ws) => {
      expect(new URL(ws.url()).searchParams.get('ticket')).toBe('ticket-7')
      sockets.push(ws)
    })
    await provide({ sockets, push: () => sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'order_updated' }))) })
  },
  phone: async ({ page, fake, hub }, provide) => {
    void hub
    await page.setViewportSize({ width: 360, height: 640 })
    await page.route(/\/(bestel|volg)\//, async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback()
      await route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'selforder.html'), 'utf8') })
    })
    await page.route(/\/api\/public\//, async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === `/api/public/self-order/${CODE}`) return route.fulfill({ json: fake.menu() })
      if (url.pathname === `/api/public/self-order/${CODE}/orders`) {
        fake.placed.push(route.request().postDataJSON())
        return route.fulfill({ status: 201, json: { token: TOKEN, number: 7 } })
      }
      if (url.pathname === `/api/public/orders/${TOKEN}`) return route.fulfill({ json: fake.status() })
      if (url.pathname === `/api/public/orders/${TOKEN}/bancontact`) {
        fake.bancontactCalls++
        return route.fulfill({ status: 201, json: { deeplinkUrl: 'https://bancontact.test/deeplink/1', checkoutUrl: 'https://bancontact.test/checkout/1', qrCodeUrl: null } })
      }
      return route.fulfill({ status: 404, json: { error: 'x', code: 'order_not_found' } })
    })
    await provide(page)
  },
})

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'horizontal overflow').toBeLessThanOrEqual(0)
}

test('order on a phone: menu → cart → pay at the toog → your number, followed live until delivered', async ({ phone: page, fake, hub }) => {
  await page.goto(`/bestel/${CODE}`)
  await expect(page.getByTestId('event-name')).toHaveText('Fuif in de Kabouterbossen')
  await noSidewaysScroll(page)

  // 1. Menu: two Pils, one Frieten.
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByRole('button', { name: 'Frieten toevoegen' }).click()
  await expect(page.getByTestId('to-cart')).toContainText('3 items')
  await expect(page.getByTestId('to-cart')).toContainText('€ 9,00')
  await noSidewaysScroll(page)

  // 2. Cart: one Pils less, then back to two.
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Pils één minder' }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('€ 6,50')
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('€ 9,00')
  await noSidewaysScroll(page)
  await page.getByRole('button', { name: 'Verder' }).click()

  // 3. Pay: at the toog.
  await expect(page.getByRole('heading', { name: 'Betaal aan de toog' })).toBeVisible()
  await expect(page.getByText('Betaal binnen 10 minuten')).toBeVisible()
  await noSidewaysScroll(page)
  await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()
  expect(fake.placed).toEqual([{ lines: [{ variantId: 'v-pils', quantity: 2 }, { variantId: 'v-frieten', quantity: 1 }] }])

  // 4. Your number, and what to do.
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page.getByTestId('follow-message')).toHaveText('Ga naar de toog en zeg: nummer 7.')
  await noSidewaysScroll(page)
  await expect.poll(() => hub.sockets.length).toBe(1)
  const callsAfterLoad = fake.statusCalls

  // Paid, being prepared: only because the hub said so.
  fake.state = 'preparing'
  hub.push()
  await expect(page.getByTestId('follow-message')).toHaveText('Je bestelling wordt klaargemaakt.')
  await expect(page.getByTestId('stations')).toContainText('Besteld')

  // The bar is ready: "Klaar!", where to pick it up.
  fake.state = 'preparing'
  fake.stations = [{ name: 'Bar', status: 'ready' }, { name: 'Keuken', status: 'in_progress' }]
  hub.push()
  await expect(page.getByRole('status')).toHaveText('Klaar!')
  await expect(page.getByTestId('follow-message')).toHaveText('Haal je bestelling op bij: Bar.')
  await noSidewaysScroll(page)

  // No polling: one status fetch per push, nothing in between.
  await page.waitForTimeout(1500)
  expect(fake.statusCalls - callsAfterLoad).toBe(2)

  // Everything delivered: back to the menu, with an empty cart.
  fake.state = 'delivered'
  fake.stations = [{ name: 'Bar', status: 'delivered' }, { name: 'Keuken', status: 'delivered' }]
  hub.push()
  await expect(page.getByTestId('follow-message')).toHaveText('Alles afgehaald. Smakelijk!')
  await page.getByRole('button', { name: 'Nieuwe bestelling' }).click()
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
  await expect(page.getByTestId('to-cart')).toHaveCount(0)
})

test('a reload during step 4 comes back to the order', async ({ phone: page, fake }) => {
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()
  await expect(page.getByTestId('order-number')).toHaveText('7')
  fake.state = 'preparing'
  await page.reload()
  await expect(page.getByTestId('follow-message')).toHaveText('Je bestelling wordt klaargemaakt.')
})

test("a customer from the toog follows their order from the customer display's QR (/volg/…)", async ({ phone: page, fake }) => {
  fake.state = 'preparing'
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page.getByTestId('follow-message')).toHaveText('Je bestelling wordt klaargemaakt.')
  await expect(page.getByText('Laat deze pagina open')).toBeVisible()
  await noSidewaysScroll(page)
})

test('closed: says so, nothing to order', async ({ phone: page, fake }) => {
  fake.open = false
  await page.goto(`/bestel/${CODE}`)
  await expect(page.getByTestId('closed')).toHaveText('Bestellen kan hier nu niet. Bestel aan de toog.')
  await expect(page.getByRole('button', { name: /toevoegen/ })).toHaveCount(0)
})

test('cancelled (not paid in time): says so, and offers a new order', async ({ phone: page, fake }) => {
  fake.state = 'cancelled'
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('follow-message')).toHaveText('Niet betaald op tijd: deze bestelling is vervallen.')
  await expect(page.getByRole('link', { name: 'Nieuwe bestelling' })).toHaveAttribute('href', `/bestel/${CODE}`)
})

test('in French on a French phone', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-BE', viewport: { width: 360, height: 640 } })
  const page = await context.newPage()
  const fake = new FakeSelfOrder()
  await page.route(/\/(bestel|volg)\//, async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    await route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'selforder.html'), 'utf8') })
  })
  await page.route(/\/api\/public\//, (route) => route.fulfill({ json: fake.menu() }))
  await page.goto(`/bestel/${CODE}`)
  await expect(page.getByRole('button', { name: 'Ajouter Pils' })).toBeVisible()
  await context.close()
})

test('pay with Bancontact: the order is placed, then off to Bancontact; back on the follow page it says what to do', async ({ phone: page, fake }) => {
  fake.payment = { counter: true, bancontact: true }
  // Bancontact's own page (this browser isn't a phone: the checkout page, not the app).
  await page.route(/bancontact\.test/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>Bancontact</p>' }))
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Frieten toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await expect(page.getByRole('heading', { name: 'Hoe wil je betalen?' })).toBeVisible()
  await expect(page.getByTestId('pay-counter')).toBeVisible()
  await noSidewaysScroll(page)
  await page.getByTestId('pay-bancontact').getByRole('button', { name: 'Betaal met Bancontact' }).click()
  await page.waitForURL('https://bancontact.test/checkout/1')
  expect(fake.placed).toHaveLength(1)
  expect(fake.bancontactCalls).toBe(1)

  // Back from the app (on the follow page): the payment is still in progress.
  fake.followPayment = { counter: true, bancontact: true, pending: true, failed: false }
  await page.goto(`/volg/${TOKEN}`)
  const again = page.getByTestId('pay-again')
  await expect(again).toContainText('Je betaling loopt — bevestig ze in je Bancontact-app.')
  await expect(again.getByRole('button', { name: 'Open Bancontact' })).toBeVisible()
  await expect(again).toContainText('Of betaal aan de toog met nummer 7.')
  await noSidewaysScroll(page)

  // It failed: try again.
  fake.followPayment = { counter: false, bancontact: true, pending: false, failed: true }
  await page.reload()
  await expect(again).toContainText('De betaling met Bancontact is niet gelukt.')
  await expect(again.getByRole('button', { name: 'Opnieuw betalen met Bancontact' })).toBeVisible()
  await expect(again).not.toContainText('toog')
})

test('Bancontact only: no counter option', async ({ phone: page, fake }) => {
  fake.payment = { counter: false, bancontact: true }
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await expect(page.getByTestId('pay-bancontact')).toBeVisible()
  await expect(page.getByTestId('pay-counter')).toHaveCount(0)
})
