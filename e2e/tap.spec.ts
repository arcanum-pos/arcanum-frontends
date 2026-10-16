// A kassa's Tap to Pay phone (/tap): paired with a code on the page itself,
// it shows its kassa's Tap to Pay payment — live over the notification
// socket — as a link into the SumUp app; back from the app, the backend
// asks SumUp. The kassa's QR opens the same page for one payment, on any
// phone. On a phone-sized screen, backend and socket faked.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1'
// A real-looking applicationServerKey: 65 bytes, base64url.
const SERVER_KEY = 'BP' + 'A'.repeat(85)

interface Charge {
  chargeId: string
  token: string
  status: 'pending' | 'succeeded' | 'failed'
  amountCents: number
  title: string
  errorMessage: string | null
  sumupApp: { affiliateKey: string; appId: string } | null
}

class FakeTap {
  pairRole = 'tap'
  pairCodes: string[] = []
  charge: Charge | null = null
  push: { publicKey: string; subscribed: boolean } | null = { publicKey: SERVER_KEY, subscribed: false }
  pushCalls: string[] = []
  returns: any[] = []
  // What the backend says after asking SumUp, back from the app.
  afterReturn: Charge['status'] = 'succeeded'
  // What the phone's own call answers (403: signed in here as someone who may not use it).
  tapStatus = 200
  state() {
    return { name: 'Telefoon toog', kassa: { terminalId: 'pos-1', name: 'Kassa toog' }, charge: this.charge, push: this.push }
  }
}

const pending = (): Charge => ({ chargeId: 'c1', token: 'tok1', status: 'pending', amountCents: 1250, title: 'Rekening 7', errorMessage: null, sumupApp: { affiliateKey: 'sup_afk_test', appId: 'be.example.pos' } })

const PAIRED = { terminalId: 'tap-1', role: 'tap', orgId: 'org-1', orgName: 'Scouts', name: 'Telefoon toog' }

const test = base.extend<{ fake: FakeTap; sockets: { send: (event: string) => void }; phone: Page }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakeTap()),
  sockets: async ({ page }, provide) => {
    const open: WebSocketRoute[] = []
    await page.routeWebSocket(/\/devices\/connect/, (ws) => {
      open.push(ws)
    })
    await provide({ send: (event) => open.forEach((ws) => ws.send(JSON.stringify({ event, payment_id: 'c1', method: 'sumup' }))) })
  },
  phone: async ({ page, fake, sockets }, provide) => {
    void sockets
    await page.setViewportSize({ width: 360, height: 640 })
    await page.route(/\/tap(\?|$)/, async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback()
      await route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'tap.html'), 'utf8') })
    })
    await page.route(/\/api\//, async (route) => {
      const req = route.request()
      const p = new URL(req.url()).pathname
      if (p === '/api/public/pair') {
        fake.pairCodes.push(req.postDataJSON().code)
        return route.fulfill({ status: 201, json: { ...PAIRED, role: fake.pairRole, orgLocale: 'nl', linkedTo: 'pos-1' } })
      }
      if (p === '/api/organizations/org-1/devices/tap-1') return route.fulfill({ json: { terminal_id: 'tap-1', role: 'tap', org_id: 'org-1', linked_to: 'pos-1' } })
      if (p === '/api/organizations/org-1/devices/tap-1/tap')
        return fake.tapStatus === 200 ? route.fulfill({ json: fake.state() }) : route.fulfill({ status: fake.tapStatus, json: { error: 'Forbidden' } })
      if (p === '/api/organizations/org-1/devices/tap-1/push') {
        fake.pushCalls.push(req.method())
        fake.push = { ...fake.push!, subscribed: req.method() === 'POST' }
        return route.fulfill({ json: { ok: true } })
      }
      if (p === '/api/devices/ws-token') return route.fulfill({ json: { token: 'ws' } })
      if (p === '/api/public/tap/c1/tok1') return fake.charge ? route.fulfill({ json: fake.charge }) : route.fulfill({ status: 404, json: { code: 'tap_payment_not_found' } })
      if (p === '/api/public/tap/c1/tok1/return') {
        fake.returns.push(req.postDataJSON())
        fake.charge = { ...fake.charge!, status: fake.afterReturn }
        return route.fulfill({ json: fake.charge })
      }
      return route.fulfill({ status: 404, json: { error: 'x' } })
    })
    await provide(page)
  },
})

// Paired once (not again on every load: "Opnieuw koppelen" forgets it).
const paired = (page: Page) =>
  page.addInitScript((t) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('arcanum-terminal', JSON.stringify(t))
  }, PAIRED)

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'horizontal overflow').toBeLessThanOrEqual(0)
}

test.describe('pairing', () => {
  test("with the console's code (filled in from its QR); then it waits for its kassa", async ({ phone: page, fake }) => {
    await page.goto('/tap?code=ABCD2345')
    await expect(page.getByTestId('tap-pair').getByRole('textbox')).toHaveValue('ABCD2345')
    await page.getByRole('button', { name: 'Koppelen' }).click()
    await expect(page.getByTestId('tap-waiting')).toBeVisible()
    await expect(page.getByTestId('tap-kassa')).toHaveText('Voor Kassa toog')
    expect(fake.pairCodes).toEqual(['ABCD2345'])
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-terminal')))!)).toMatchObject({ terminalId: 'tap-1', role: 'tap' })
    await noSidewaysScroll(page)
  })

  test("another device's code: says so", async ({ phone: page, fake }) => {
    fake.pairRole = 'cfd'
    await page.goto('/tap')
    await page.getByTestId('tap-pair').getByRole('textbox').fill('ABCD-2345')
    await page.getByRole('button', { name: 'Koppelen' }).click()
    await expect(page.getByRole('alert')).toContainText('ander soort toestel')
  })

  test('an iPhone in Safari: first to the home screen (it keeps its own pairing there)', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: IPHONE, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.route(/\/tap(\?|$)/, (route) => route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'tap.html'), 'utf8') }))
    await page.goto('/tap')
    await expect(page.getByTestId('tap-ios-first')).toContainText('Zet op beginscherm')
    // The page's manifest: the home-screen icon opens /tap.
    expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('/tap/manifest.webmanifest')
    await context.close()
  })
})

test("can't see its kassa's payments: says so — never a reload loop — and offers a new code", async ({ phone: page, fake }) => {
  await paired(page)
  fake.tapStatus = 403
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/tap')
  await expect(page.getByTestId('tap-problem')).toContainText('kan de betalingen van zijn kassa niet zien')
  await page.waitForTimeout(500)
  expect(loads).toBe(1)
  await page.getByRole('button', { name: 'Opnieuw koppelen' }).click()
  await expect(page.getByTestId('tap-pair')).toBeVisible()
})

test.describe('a payment from its kassa', () => {
  test('appears live; the link opens the SumUp app with the amount, and comes back here', async ({ phone: page, fake, sockets }) => {
    await paired(page)
    await page.goto('/tap')
    await expect(page.getByTestId('tap-waiting')).toBeVisible()
    fake.charge = pending()
    sockets.send('payment_updated')
    await expect(page.getByTestId('tap-amount')).toHaveText('€ 12,50')
    const href = (await page.getByTestId('tap-pay').getAttribute('href'))!
    expect(href.startsWith('sumupmerchant://pay/1.0?')).toBe(true)
    const q = new URL(href.replace('sumupmerchant://', 'https://x/')).searchParams
    expect(q.get('amount')).toBe('12.50')
    expect(q.get('foreign-tx-id')).toBe('c1')
    expect(q.get('affiliate-key')).toBe('sup_afk_test')
    expect(q.get('callbacksuccess')).toBe(`${new URL(page.url()).origin}/tap?charge=c1&t=tok1`)
    // Cancelled at the kassa: gone from here.
    fake.charge = null
    sockets.send('reset')
    await expect(page.getByTestId('tap-waiting')).toBeVisible()
    await noSidewaysScroll(page)
  })

  test("back from the SumUp app: the backend asks SumUp; paid — then back to waiting", async ({ phone: page, fake }) => {
    await paired(page)
    fake.charge = pending()
    await page.goto('/tap?charge=c1&t=tok1&smp-status=success&smp-tx-code=TX1')
    await expect(page.getByTestId('tap-paid')).toBeVisible()
    expect(fake.returns).toEqual([{ status: 'success' }])
    fake.charge = null
    await page.getByRole('button', { name: 'Klaar' }).click()
    await expect(page.getByTestId('tap-waiting')).toBeVisible()
    expect(new URL(page.url()).search).toBe('')
  })

  test('back, not paid: says so', async ({ phone: page, fake }) => {
    await paired(page)
    fake.charge = pending()
    fake.afterReturn = 'failed'
    await page.goto('/tap?charge=c1&t=tok1&smp-status=failed')
    await expect(page.getByTestId('tap-failed')).toBeVisible()
  })
})

test.describe("the kassa's QR, on any phone", () => {
  test('not paired: the payment by its link, to the SumUp app', async ({ phone: page, fake }) => {
    fake.charge = pending()
    await page.goto('/tap?charge=c1&t=tok1')
    await expect(page.getByTestId('tap-amount')).toHaveText('€ 12,50')
    await expect(page.getByTestId('tap-pay')).toHaveAttribute('href', /^sumupmerchant:\/\/pay\/1\.0\?/)
    await expect(page.getByTestId('tap-pair')).toHaveCount(0)
  })

  test('a payment that no longer exists', async ({ phone: page }) => {
    await page.goto('/tap?charge=c1&t=tok1')
    await expect(page.getByTestId('tap-gone')).toBeVisible()
  })
})

// A browser that can do Web Push, faked (like Safari: asked after an
// await, it refuses without asking).
const pushBrowser = () => {
  const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'P256', auth: 'AUTH' } }), unsubscribe: async () => true }
  const registration = { pushManager: { getSubscription: async () => null, subscribe: async () => subscription } }
  Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true })
  Object.defineProperty(window, 'Notification', { value: { requestPermission: async () => ((window as any).__sw ? 'denied' : 'granted') }, configurable: true })
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

test('notifications: turned on for this phone, its own service worker scope', async ({ phone: page, fake }) => {
  await paired(page)
  await page.addInitScript(pushBrowser)
  await page.goto('/tap')
  await page.getByTestId('tap-push-turn-on').click()
  await expect(page.getByTestId('tap-push-on')).toBeVisible()
  expect(fake.pushCalls).toEqual(['POST'])
  expect(await page.evaluate(() => (window as any).__sw)).toEqual(['/push-sw.js', '/tap'])
})
