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
// An order this phone placed later (a home-screen app's next order).
const NEWER = 'tok_newerabcdefghijklmno'

type Station = { name: string; status: 'ordered' | 'in_progress' | 'ready' | 'delivered' }

class FakeSelfOrder {
  open = true
  payment: { counter: boolean; bancontact: boolean; tab?: boolean } = { counter: true, bancontact: false }
  // On a tab: a name and a mobile number or e-mail asked when it opens.
  contact = false
  tabOpen = false
  rounds: any[] = []
  // The follow page's payment block (a self-order waiting for payment).
  followPayment: { counter: boolean; bancontact: boolean; pending: boolean; failed: boolean } | null = null
  bancontactCalls = 0
  placed: any[] = []
  statusCalls = 0
  state = 'awaiting_payment'
  stations: Station[] = [{ name: 'Bar', status: 'ordered' }, { name: 'Keuken', status: 'ordered' }]
  // A second ordering mode (take away, its own menu) — guests choose first.
  takeAway = false
  // A kassa customer's order (the customer display's QR): no event to order from.
  selfOrderCode: string | null = CODE
  // The follow page: the tab's mode, and its name when there's more than one.
  modeId = 'm-plaatse'
  modeName: string | null = null
  // The "ready" SMS: offered or not, the number given (masked), per station how it went.
  sms: { available: boolean; phone: string | null; stations: { name: string; status: string }[] } | null = null
  notifyCalls: any[] = []
  // Web Push (release G'): offered or not, this order has a browser; what the page sent.
  push: { publicKey: string; available: boolean; subscribed: boolean } | null = null
  pushCalls: { method: string; body: any }[] = []
  menu() {
    const modes = [
      {
        id: 'm-plaatse',
        name: 'Ter plaatse',
        payment: this.payment,
        contact: this.contact,
        catalog: {
          id: 'c',
          sections: [
            { id: 's1', name: 'Drank', entries: [{ variantId: 'v-pils', name: 'Pils', priceCents: 250 }, { variantId: 'v-cola', name: 'Cola zonder suiker en met een heel lange naam', priceCents: 220 }] },
            { id: 's2', name: 'Eten', entries: [{ variantId: 'v-frieten', name: 'Frieten', priceCents: 400 }] },
          ],
        },
      },
    ]
    if (this.takeAway)
      modes.push({
        id: 'm-mee',
        name: 'Take away',
        payment: { counter: false, bancontact: true },
        contact: false,
        catalog: { id: 'c2', sections: [{ id: 's3', name: 'Mee', entries: [{ variantId: 'v-frieten-mee', name: 'Frieten in een doosje', priceCents: 450 }] }] },
      })
    return {
      eventName: 'Fuif in de Kabouterbossen',
      orgName: 'Scouts Kabouterland',
      orgId: 'org-1',
      locale: 'nl',
      open: this.open,
      modes: this.open ? modes : [],
    }
  }
  status() {
    this.statusCalls++
    return {
      number: 7,
      eventName: 'Fuif in de Kabouterbossen',
      orgName: 'Scouts Kabouterland',
      orgId: 'org-1',
      locale: 'nl',
      selfOrder: true,
      modeId: this.modeId,
      mode: this.modeName,
      sms: this.sms,
      push: this.push,
      payLater: this.tabOpen,
      tabOpen: this.tabOpen,
      state: this.state,
      stations: this.stations,
      lines: [{ name: 'Pils', quantity: 2, unitPriceCents: 250 }, { name: 'Frieten', quantity: 1, unitPriceCents: 400 }],
      totalCents: 900,
      selfOrderCode: this.selfOrderCode,
      payment: this.state === 'awaiting_payment' || this.tabOpen ? this.followPayment : null,
      // Like the backend: no live updates once it's done — an open tab isn't.
      hubTicket: !this.tabOpen && ['delivered', 'cancelled', 'nothing_to_prepare'].includes(this.state) ? null : 'ticket-7',
    }
  }
}

// The "ready" beep stays in the test browser, not the developer's speakers:
// the page's sound unlock finds no AudioContext and plays nothing.
const silence = () => {
  Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true })
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
    // Every socket that's still open (a page reopens one after a step).
    const push = () =>
      sockets.forEach((ws) => {
        try {
          ws.send(JSON.stringify({ event: 'order_updated' }))
        } catch {
          // closed
        }
      })
    await provide({ sockets, push })
  },
  phone: async ({ page, fake, hub }, provide) => {
    void hub
    await page.addInitScript(silence)
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
      if (url.pathname === `/api/public/orders/${NEWER}`) return route.fulfill({ json: { ...fake.status(), number: 8, state: 'preparing', stations: [{ name: 'Bar', status: 'in_progress' }], hubTicket: null } })
      if (url.pathname === `/api/public/orders/${TOKEN}/orders`) {
        fake.rounds.push(route.request().postDataJSON())
        return route.fulfill({ status: 201, json: { ok: true } })
      }
      if (url.pathname === `/api/public/orders/${TOKEN}/notify`) {
        const body = route.request().postDataJSON()
        fake.notifyCalls.push(body)
        if (!/^0\d{9}$/.test(String(body.phone).replace(/\s/g, ''))) return route.fulfill({ status: 400, json: { error: 'x', code: 'invalid_phone', params: { countries: '+32' } } })
        fake.sms = { ...fake.sms!, phone: `••• ${String(body.phone).slice(-2)}` }
        return route.fulfill({ json: { ok: true, phone: fake.sms.phone } })
      }
      if (url.pathname === `/api/public/orders/${TOKEN}/push`) {
        const method = route.request().method()
        fake.pushCalls.push({ method, body: method === 'POST' ? route.request().postDataJSON() : null })
        fake.push = { ...fake.push!, subscribed: method === 'POST' }
        return route.fulfill({ json: { ok: true } })
      }
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
  expect(fake.placed).toEqual([{ modeId: 'm-plaatse', lines: [{ variantId: 'v-pils', quantity: 2 }, { variantId: 'v-frieten', quantity: 1 }] }])

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

// A browser that keeps nothing for the page (storage blocked).
const blockStorage = () => {
  Storage.prototype.setItem = () => {
    throw new DOMException('blocked', 'SecurityError')
  }
}

test('step 4 asks nothing about its link where the browser remembers the order', async ({ phone: page, fake }) => {
  fake.state = 'preparing'
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page.getByTestId('keep-link')).toHaveCount(0)
})

test('storage blocked: step 4 offers to keep its link — copied to the clipboard', async ({ phone: page, fake, hub }) => {
  await page.addInitScript(blockStorage)
  // The clipboard, stubbed (the same in every browser engine).
  await page.addInitScript(() => {
    ;(window as any).__copied = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => (window as any).__copied.push(text) }, configurable: true })
  })
  fake.state = 'preparing'
  await page.goto(`/volg/${TOKEN}`)
  const keep = page.getByTestId('keep-link')
  await expect(keep).toContainText('Bewaar deze link')
  await noSidewaysScroll(page)
  await keep.getByTestId('copy-link').click()
  await expect(keep.getByTestId('copy-link')).toHaveText('Gekopieerd')
  expect(await page.evaluate(() => (window as any).__copied)).toEqual([`${new URL(page.url()).origin}/volg/${TOKEN}`])
  // Done: nothing to keep any more.
  fake.state = 'delivered'
  hub.push()
  await expect(page.getByTestId('follow-message')).toHaveText('Alles afgehaald. Smakelijk!')
  await expect(keep).toHaveCount(0)
})

test('storage blocked, a phone with a share sheet: shares the link', async ({ phone: page, fake }) => {
  await page.addInitScript(blockStorage)
  await page.addInitScript(() => {
    ;(window as any).__shared = []
    Object.defineProperty(navigator, 'share', { value: async (data: unknown) => (window as any).__shared.push(data), configurable: true })
  })
  fake.state = 'preparing'
  await page.goto(`/volg/${TOKEN}`)
  await page.getByTestId('keep-link').getByRole('button', { name: 'Delen' }).click()
  const shared = await page.evaluate(() => (window as any).__shared)
  expect(shared).toEqual([{ title: 'Mijn bestelling #7', text: 'Mijn bestelling #7', url: `${new URL(page.url()).origin}/volg/${TOKEN}` }])
})

test('two ordering modes: first choose how, then that mode\'s menu and payment', async ({ phone: page, fake }) => {
  fake.takeAway = true
  await page.route(/bancontact\.test/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>Bancontact</p>' }))
  await page.goto(`/bestel/${CODE}`)
  const choose = page.getByTestId('choose-mode')
  await expect(choose).toContainText('Hoe wil je bestellen?')
  await noSidewaysScroll(page)
  await choose.getByRole('button', { name: 'Take away' }).click()
  await expect(page.getByTestId('chosen-mode')).toContainText('Take away')
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toHaveCount(0)
  // Changed my mind: back to the choice, then the other menu.
  await page.getByTestId('chosen-mode').getByRole('button', { name: 'Wijzig' }).click()
  await choose.getByRole('button', { name: 'Ter plaatse' }).click()
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
  await page.getByTestId('chosen-mode').getByRole('button', { name: 'Wijzig' }).click()
  await choose.getByRole('button', { name: 'Take away' }).click()
  await page.getByRole('button', { name: 'Frieten in een doosje toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  // Take away takes only Bancontact.
  await expect(page.getByTestId('pay-counter')).toHaveCount(0)
  await page.getByTestId('pay-bancontact').getByRole('button', { name: 'Betaal met Bancontact' }).click()
  await page.waitForURL('https://bancontact.test/checkout/1')
  expect(fake.placed).toEqual([{ modeId: 'm-mee', lines: [{ variantId: 'v-frieten-mee', quantity: 1 }] }])

  // The follow page shows the mode.
  fake.state = 'preparing'
  fake.modeId = 'm-mee'
  fake.modeName = 'Take away'
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('order-mode')).toHaveText('Take away')
})

test('a direct link to one ordering mode (a poster at the take-away window) skips the choice', async ({ phone: page, fake }) => {
  fake.takeAway = true
  await page.goto(`/bestel/${CODE}?m=m-mee`)
  await expect(page.getByRole('button', { name: 'Frieten in een doosje toevoegen' })).toBeVisible()
  await expect(page.getByTestId('choose-mode')).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Nieuwe bestelling' }).click()
  await page.waitForURL(`**/bestel/${CODE}`)
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
})

// A home-screen app opens the order it was added from — every time, days
// later too. Once that's finished: not the old order again.
const DELIVERED: Station[] = [{ name: 'Bar', status: 'delivered' }, { name: 'Keuken', status: 'delivered' }]
const remember = (page: Page, token: string) => page.evaluate(([code, t]) => localStorage.setItem(`arcanum-selforder:${code}`, JSON.stringify({ cart: {}, token: t, modeId: null })), [CODE, token])

test('opened on a finished order (collected, paid): straight to the menu — from its own link and from the event\'s', async ({ phone: page, fake }) => {
  fake.state = 'delivered'
  fake.stations = DELIVERED
  await page.goto(`/volg/${TOKEN}`)
  await page.waitForURL(`**/bestel/${CODE}`)
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
  await expect(page.getByTestId('follow')).toHaveCount(0)
  // The event's link, with this phone remembering that order: the menu too.
  await remember(page, TOKEN)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
  await expect(page.getByTestId('follow')).toHaveCount(0)
  // Paid, nothing to prepare: the same.
  fake.state = 'nothing_to_prepare'
  await page.goto(`/volg/${TOKEN}`)
  await page.waitForURL(`**/bestel/${CODE}`)
})

test('opened on a finished order, with a newer one placed on this phone since: that one', async ({ phone: page, fake }) => {
  await page.goto(`/bestel/${CODE}`)
  await remember(page, NEWER)
  fake.state = 'delivered'
  fake.stations = DELIVERED
  await page.goto(`/volg/${TOKEN}`)
  await page.waitForURL(`**/volg/${NEWER}`)
  await expect(page.getByTestId('order-number')).toHaveText('8')
})

test('a finished order that is not one to go on from stays: a tab still to settle, a kassa customer\'s', async ({ phone: page, fake }) => {
  fake.state = 'delivered'
  fake.stations = DELIVERED
  fake.tabOpen = true
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('order-number')).toHaveText('7')
  fake.tabOpen = false
  fake.selfOrderCode = null
  await page.reload()
  await expect(page.getByTestId('follow-message')).toHaveText('Alles afgehaald. Smakelijk!')
  expect(page.url()).toContain(`/volg/${TOKEN}`)
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

test('on a tab: order, order more on the same tab, settle at the end — on a phone', async ({ phone: page, fake, hub }) => {
  fake.payment = { counter: true, bancontact: true, tab: true }
  fake.state = 'preparing'
  fake.tabOpen = true
  fake.followPayment = { counter: true, bancontact: true, pending: false, failed: false }
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  // No payment yet: it goes on the tab.
  const order = page.getByTestId('tab-order')
  await expect(order).toContainText('betalen doe je bij vertrek')
  await noSidewaysScroll(page)
  await order.getByRole('button', { name: 'Bestellen' }).click()
  expect(fake.placed).toHaveLength(1)

  // Your tab: being prepared, order more, settle up.
  await expect(page.getByText('Je rekening #7')).toBeVisible()
  await expect(page.getByTestId('settle')).toContainText('Ga bij vertrek naar de toog en zeg: nummer 7.')
  await expect(page.getByTestId('settle').getByRole('button', { name: 'Betaal je rekening met Bancontact' })).toBeVisible()
  await noSidewaysScroll(page)

  // All delivered, still open: not the end — no "new order", it stays your tab.
  fake.state = 'delivered'
  fake.stations = [{ name: 'Bar', status: 'delivered' }, { name: 'Keuken', status: 'delivered' }]
  await expect.poll(() => hub.sockets.length).toBe(1)
  hub.push()
  await expect(page.getByTestId('follow-message')).toHaveText('Alles afgehaald. Bestel gerust bij.')
  await page.waitForTimeout(500)
  await expect(page.getByTestId('order-more')).toBeVisible()

  // A second round: menu → cart → add to the tab.
  await page.getByTestId('order-more').click()
  await page.getByRole('button', { name: 'Frieten toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByTestId('add-round').getByRole('button', { name: 'Toevoegen aan mijn rekening' }).click()
  expect(fake.rounds).toEqual([{ lines: [{ variantId: 'v-frieten', quantity: 1 }] }])
  expect(fake.placed[0].modeId).toBe('m-plaatse')
  expect(fake.placed).toHaveLength(1)
  await expect(page.getByText('Je rekening #7')).toBeVisible()

  // Paid at the toog and all delivered: back to the menu.
  fake.tabOpen = false
  hub.push()
  await expect(page.getByTestId('follow-message')).toHaveText('Alles afgehaald. Smakelijk!')
  await page.getByRole('button', { name: 'Nieuwe bestelling' }).click()
  await expect(page.getByRole('button', { name: 'Pils toevoegen' })).toBeVisible()
})

test('an SMS when it\'s ready: a number on the order page, shown back masked; per station whether it went — on a small phone', async ({ phone: page, fake, hub }) => {
  fake.state = 'preparing'
  fake.sms = { available: true, phone: null, stations: [] }
  await page.goto(`/volg/${TOKEN}`)
  const sms = page.getByTestId('sms')
  await expect(sms).toContainText('Sms als het klaar is')
  await noSidewaysScroll(page)
  // Not a number we can use: says so.
  await sms.getByLabel('Gsm-nummer').fill('12')
  await sms.getByRole('button', { name: 'Stuur me een sms' }).click()
  await expect(sms.getByRole('alert')).toHaveText('Dat is geen gsm-nummer dat we kunnen gebruiken (begint met +32, of met 0)')
  await sms.getByLabel('Gsm-nummer').fill('0470 12 34 56')
  await sms.getByRole('button', { name: 'Stuur me een sms' }).click()
  await expect(sms.getByTestId('sms-phone')).toHaveText('We sturen een sms naar ••• 56 zodra iets klaar is.')
  expect(fake.notifyCalls.at(-1)).toEqual({ phone: '0470 12 34 56' })
  await noSidewaysScroll(page)

  // The bar's part ready: its SMS went — live, through the order hub.
  await expect.poll(() => hub.sockets.length).toBeGreaterThan(0)
  fake.stations = [{ name: 'Bar', status: 'ready' }, { name: 'Keuken', status: 'in_progress' }]
  fake.sms = { available: true, phone: '••• 56', stations: [{ name: 'Bar', status: 'sent' }, { name: 'Keuken', status: 'failed' }] }
  hub.push()
  await expect(sms.getByTestId('sms-station')).toHaveText(['✓ Sms verstuurd: Bar', 'Sms voor Keuken kon niet verstuurd worden.'])

  // Change the number.
  await sms.getByRole('button', { name: 'Wijzig' }).click()
  await sms.getByLabel('Gsm-nummer').fill('0499 99 99 01')
  await sms.getByRole('button', { name: 'Stuur me een sms' }).click()
  await expect(sms.getByTestId('sms-phone')).toHaveText('We sturen een sms naar ••• 01 zodra iets klaar is.')
})

test('no SMS offered when the ordering mode has none', async ({ phone: page, fake }) => {
  fake.state = 'preparing'
  await page.goto(`/volg/${TOKEN}`)
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page.getByTestId('sms')).toHaveCount(0)
})

test('once placed, the address is the follow page: Back and Forward come back to it', async ({ phone: page, fake }) => {
  await page.goto('/selforder.html') // something before the event's page
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page).toHaveURL(new RegExp(`/volg/${TOKEN}$`))
  fake.state = 'preparing'
  await page.goBack()
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`/volg/${TOKEN}$`))
  await expect(page.getByTestId('follow-message')).toHaveText('Je bestelling wordt klaargemaakt.')
  // The event's link brings it back too (this phone remembers the order).
  await page.goto(`/bestel/${CODE}`)
  await expect(page.getByTestId('order-number')).toHaveText('7')
  await expect(page).toHaveURL(new RegExp(`/volg/${TOKEN}$`))
})

test('paid with Bancontact: Back from Bancontact lands on the follow page', async ({ phone: page, fake }) => {
  fake.payment = { counter: true, bancontact: true }
  await page.route(/bancontact\.test/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>Bancontact</p>' }))
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByTestId('pay-bancontact').getByRole('button', { name: 'Betaal met Bancontact' }).click()
  await page.waitForURL('https://bancontact.test/checkout/1')
  fake.state = 'preparing'
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/volg/${TOKEN}$`))
  await expect(page.getByTestId('follow-message')).toHaveText('Je bestelling wordt klaargemaakt.')
})

test('a new order after one is done: the way of ordering is asked again', async ({ phone: page, fake }) => {
  fake.takeAway = true
  await page.goto(`/bestel/${CODE}`)
  await page.getByTestId('choose-mode').getByRole('button', { name: 'Ter plaatse' }).click()
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()
  await expect(page.getByTestId('order-number')).toHaveText('7')
  fake.state = 'cancelled'
  await page.reload()
  // On the follow page on its own (as after Bancontact): a new order starts at the choice.
  await page.getByRole('button', { name: 'Nieuwe bestelling' }).click()
  await expect(page.getByTestId('choose-mode')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/bestel/${CODE}$`))
})

test('a new order from the order page itself: the choice again too', async ({ phone: page, fake, hub }) => {
  fake.takeAway = true
  await page.goto(`/bestel/${CODE}`)
  await page.getByTestId('choose-mode').getByRole('button', { name: 'Ter plaatse' }).click()
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  await page.getByRole('button', { name: 'Bestelling plaatsen' }).click()
  await expect.poll(() => hub.sockets.length).toBeGreaterThan(0)
  fake.state = 'delivered'
  fake.stations = [{ name: 'Bar', status: 'delivered' }, { name: 'Keuken', status: 'delivered' }]
  hub.push()
  await page.getByRole('button', { name: 'Nieuwe bestelling' }).click()
  await expect(page.getByTestId('choose-mode')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/bestel/${CODE}$`))
})

test('on a tab whose mode asks it: a name and a mobile number or e-mail first — on a small phone', async ({ phone: page, fake }) => {
  fake.payment = { counter: true, bancontact: false, tab: true }
  fake.contact = true
  fake.state = 'preparing'
  fake.tabOpen = true
  await page.goto(`/bestel/${CODE}`)
  await page.getByRole('button', { name: 'Pils toevoegen' }).click()
  await page.getByTestId('to-cart').click()
  await page.getByRole('button', { name: 'Verder' }).click()
  const form = page.getByTestId('tab-order')
  await expect(form.getByTestId('tab-contact')).toContainText('Wie ben je?')
  await noSidewaysScroll(page)
  const order = form.getByRole('button', { name: 'Bestellen' })
  await expect(order).toBeDisabled()
  await form.getByLabel('Naam').fill('Jan')
  // A name alone isn't enough: a number or an e-mail too.
  await expect(order).toBeDisabled()
  await form.getByLabel('E-mail').fill('jan@example.be')
  await order.click()
  expect(fake.placed).toEqual([{ modeId: 'm-plaatse', lines: [{ variantId: 'v-pils', quantity: 1 }], contact: { name: 'Jan', phone: '', email: 'jan@example.be' } }])
  await expect(page.getByText('Je rekening #7')).toBeVisible()
})

// A browser that can do Web Push, faked: the test browser has no push
// service of its own. `permission`: what the guest answers; `already`: the
// permission before anything is asked ('denied': blocked for the site, or a private window).
const pushBrowser = ({ permission, already }: { permission: string; already: string }) => {
  const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'P256', auth: 'AUTH' } }), unsubscribe: async () => !((window as any).__subscribed = false) }
  const registration = {
    pushManager: {
      getSubscription: async () => ((window as any).__subscribed ? subscription : null),
      subscribe: async (options: { applicationServerKey: Uint8Array }) => {
        ;(window as any).__subscribed = true
        ;(window as any).__serverKeyLength = options.applicationServerKey.length
        return subscription
      },
    },
  }
  Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true })
  // Like Safari: asked after something was awaited (the service worker
  // registered first), it refuses without asking.
  Object.defineProperty(window, 'Notification', { value: { permission: already, requestPermission: async () => ((window as any).__sw ? 'denied' : permission) }, configurable: true })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: async (url: string, options: { scope: string }) => {
        ;(window as any).__sw = [url, options.scope]
        return registration
      },
      getRegistration: async () => registration,
    },
    configurable: true,
  })
}
// A real-looking applicationServerKey: 65 bytes, base64url.
const SERVER_KEY = 'BP' + 'A'.repeat(85)

test.describe("a notification when it's ready (Web Push, release G')", () => {
  test('turned on with a tap: the subscription goes to the backend; then no SMS asked; turned off again', async ({ phone: page, fake }) => {
    await page.addInitScript(pushBrowser, { permission: 'granted', already: 'default' })
    fake.state = 'preparing'
    fake.sms = { available: true, phone: null, stations: [] }
    fake.push = { publicKey: SERVER_KEY, available: true, subscribed: false }
    await page.goto(`/volg/${TOKEN}`)
    const push = page.getByTestId('push')
    await expect(push).toHaveAttribute('data-support', 'yes')
    await expect(page.getByTestId('sms')).toBeVisible()
    await push.getByTestId('push-turn-on').click()
    await expect(push.getByTestId('push-on')).toContainText('Je krijgt een melding')
    expect(fake.pushCalls[0]).toEqual({ method: 'POST', body: { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'P256', auth: 'AUTH' } } } })
    expect(await page.evaluate(() => (window as any).__sw)).toEqual(['/push-sw.js', '/volg/'])
    expect(await page.evaluate(() => (window as any).__serverKeyLength)).toBe(65)
    // A notification is enough: no SMS asked any more.
    await expect(page.getByTestId('sms')).toHaveCount(0)
    await noSidewaysScroll(page)
    await push.getByRole('button', { name: 'Uitzetten' }).click()
    await expect(push.getByTestId('push-turn-on')).toBeVisible()
    expect(fake.pushCalls[1].method).toBe('DELETE')
  })

  test('the guest says no: why, and that the page follows the order anyway; nothing sent', async ({ phone: page, fake }) => {
    await page.addInitScript(pushBrowser, { permission: 'denied', already: 'default' })
    fake.state = 'preparing'
    fake.push = { publicKey: SERVER_KEY, available: true, subscribed: false }
    await page.goto(`/volg/${TOKEN}`)
    await page.getByTestId('push-turn-on').click()
    const blocked = page.getByTestId('push-blocked')
    await expect(blocked).toContainText('Meldingen zijn geblokkeerd in deze browser')
    await expect(blocked).toContainText('privévenster')
    await expect(blocked).toContainText('volgt ze je bestelling vanzelf')
    // No SMS offered here: none suggested.
    await expect(blocked).not.toContainText('sms')
    await expect(page.getByTestId('push-turn-on')).toHaveCount(0)
    expect(fake.pushCalls).toEqual([])
  })

  test('blocked already (settings, private window): said at once, no button; the SMS suggested when it is offered', async ({ phone: page, fake }) => {
    await page.addInitScript(pushBrowser, { permission: 'denied', already: 'denied' })
    fake.state = 'preparing'
    fake.sms = { available: true, phone: null, stations: [] }
    fake.push = { publicKey: SERVER_KEY, available: true, subscribed: false }
    await page.goto(`/volg/${TOKEN}`)
    await expect(page.getByTestId('push-blocked')).toContainText('Of laat hieronder je nummer achter voor een sms')
    await expect(page.getByTestId('push-turn-on')).toHaveCount(0)
    await expect(page.getByTestId('sms')).toBeVisible()
    await noSidewaysScroll(page)
  })

  test('a browser that took notifications for an earlier order: this one gets them too, without a tap — not after turning them off', async ({ phone: page, fake }) => {
    await page.addInitScript(pushBrowser, { permission: 'granted', already: 'granted' })
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('off')) (window as any).__subscribed = true
    })
    fake.state = 'preparing'
    fake.push = { publicKey: SERVER_KEY, available: true, subscribed: false }
    await page.goto(`/volg/${TOKEN}`)
    await expect(page.getByTestId('push-on')).toBeVisible()
    expect(fake.pushCalls).toEqual([{ method: 'POST', body: { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'P256', auth: 'AUTH' } } } }])
    // Nothing asked, nothing registered anew.
    expect(await page.evaluate(() => (window as any).__sw)).toBeUndefined()
    // Turned off (the browser's subscription gone): the next time, a button again.
    await page.evaluate(() => sessionStorage.setItem('off', '1'))
    await page.getByRole('button', { name: 'Uitzetten' }).click()
    await expect(page.getByTestId('push-turn-on')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('push-turn-on')).toBeVisible()
    expect(fake.pushCalls.map((c) => c.method)).toEqual(['POST', 'DELETE'])
  })

  test('not offered without the installation key', async ({ phone: page, fake }) => {
    fake.state = 'preparing'
    await page.goto(`/volg/${TOKEN}`)
    await expect(page.getByTestId('order-number')).toHaveText('7')
    await expect(page.getByTestId('push')).toHaveCount(0)
  })

  test.describe('on an iPhone, in Safari', () => {
    test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1' })
    test('the steps to the home screen, and a manifest that opens this order from there', async ({ phone: page, fake }) => {
      fake.state = 'preparing'
      fake.push = { publicKey: SERVER_KEY, available: true, subscribed: false }
      await page.goto(`/volg/${TOKEN}`)
      const push = page.getByTestId('push')
      await expect(push).toHaveAttribute('data-support', 'ios-home-screen')
      await expect(push).toContainText('Melding op je iPhone')
      await expect(push.getByTestId('push-ios-steps').locator('li')).toHaveCount(3)
      await expect(push.getByTestId('push-turn-on')).toHaveCount(0)
      // The organisation's own icon on it (Weergave → App-iconen).
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', `/volg/${TOKEN}/manifest.webmanifest?icon=org-1%2Fselforder`)
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/org/org-1/selforder-180.png')
      await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Scouts Kabouterland')
    })
  })
})
