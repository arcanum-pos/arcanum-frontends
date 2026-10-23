// The website's screenshots (npm run screenshots, playwright.screenshots.config.ts):
// the kassa, the customer display and the console with a scouts group's
// spaghetti evening as sample data (sample.ts), in Dutch, French and English. Each is written as
// <name>-<lang>.png to SHOTS_DIR (default: the website's public/screenshots).
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { expect, test } from '../e2e/console-fixtures'
import { ORG_ID, type FakeCatalogAdmin } from '../e2e/fake-catalog-admin'
import { BROWSER_LOCALE, LANGS, NAMES, salesReport, type Lang } from './sample'
import { evening, openKassa, QR, seedMenu } from './scenes'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.SHOTS_DIR ?? path.resolve(HERE, '../../arcanum-bootstrapper/public/screenshots')
mkdirSync(OUT, { recursive: true })

const shot = (page: Page, name: string, lang: Lang) => page.screenshot({ path: path.join(OUT, `${name}-${lang}.png`), animations: 'disabled' })

const openTab4 = (page: Page) => page.getByRole('button', { name: /^#1 / }).click()

for (const lang of LANGS) {
  test.describe(lang, () => {
    test.use({ locale: BROWSER_LOCALE[lang] })

    test('kassa: a tab, the tabs of today, splitting', async ({ page }) => {
      const backend = evening(lang)
      await openKassa(page, backend, lang)
      await openTab4(page)
      await expect(page.getByTestId('tab-panel')).toContainText(NAMES[lang].items.pancake)
      await shot(page, 'kassa', lang)

      await page.getByTestId('tab-panel').getByRole('button', { name: NAMES[lang].ui.split, exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await shot(page, 'kassa-split', lang)
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: NAMES[lang].ui.overview }).click()
      await expect(page.getByTestId('overview-row').first()).toBeVisible()
      await shot(page, 'kassa-overview', lang)
    })

    test('customer display: the order and the Bancontact QR', async ({ page }) => {
      const backend = evening(lang)
      await openKassa(page, backend, lang)
      const display = await page.context().newPage()
      // Full size: at 640 high its help text runs into the buttons below it.
      await display.setViewportSize({ width: 1280, height: 800 })
      await display.routeWebSocket(/\/devices\/connect/, () => {})
      await display.goto('/display.html?terminal=cfd-1')
      await openTab4(page)
      await page.getByLabel('Bancontact').check()
      await page.getByRole('button', { name: new RegExp(`^${NAMES[lang].ui.pay} €`) }).click()
      const waiting = display.getByTestId('cfd-waiting')
      const qr = waiting.locator('img')
      await expect(qr).toBeVisible()
      await qr.evaluate((img: HTMLImageElement, src) => (img.src = src), QR)
      await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
      await shot(display, 'display', lang)
    })

    test('console: menu, reports, devices', async ({ console: open, catalogAdmin, page: consolePage }) => {
      // The scouts group and its admin instead of the fakes' test names (routes added
      // later win over the fixture's).
      await consolePage.route(/\/api\/organizations$/, (route) =>
        route.fulfill({ json: [{ id: ORG_ID, name: 'Scouts Kabouterland', logoUrl: null, theme: null, createdAt: '2026-01-01' }] })
      )
      await consolePage.route(/\/whoami$/, (route) =>
        route.fulfill({ json: { sub: 'admin', email: 'an@scoutskabouterland.be', name: 'An Janssens', firstName: 'An', lastName: 'Janssens', username: 'an' } })
      )
      seedMenu(catalogAdmin, lang)
      const catalog = catalogAdmin.catalogs[0]
      let page = await open(`/catalogs/${catalog.id}`)
      await expect(page.locator('[data-testid^=section-]').first()).toBeVisible()
      await shot(page, 'console-catalog', lang)

      catalogAdmin.salesReport = { ...catalogAdmin.salesReport, ...salesReport(lang) }
      page = await open('/reports')
      await expect(page.getByText(NAMES[lang].items.pils).first()).toBeVisible()
      await shot(page, 'console-reports', lang)

      catalogAdmin.sumupReaders = [
        { id: 'rdr_3KQ8Z2V7XWJ4', name: NAMES[lang].readers[0], status: 'paired', model: 'solo' },
        { id: 'rdr_9TF2M6P1HDC8', name: NAMES[lang].readers[1], status: 'paired', model: 'solo' },
      ]
      const now = Date.now()
      catalogAdmin.orgDevices = [
        { terminal_id: 'pos-7f3a9c21', role: 'pos', linked_to: null, created_at: new Date(now - 9 * 86400e3).toISOString(), online: true, name: `${NAMES[lang].readers[0]} 1` },
        { terminal_id: 'pos-b81e44d0', role: 'pos', linked_to: null, created_at: new Date(now - 9 * 86400e3).toISOString(), online: true, name: `${NAMES[lang].readers[0]} 2` },
        { terminal_id: 'cfd-25c0e7aa', role: 'cfd', linked_to: 'pos-7f3a9c21', created_at: new Date(now - 8 * 86400e3).toISOString(), online: true, name: NAMES[lang].display },
      ]
      page = await open('/devices')
      await expect(page.getByText('rdr_3KQ8Z2V7XWJ4')).toBeVisible()
      await shot(page, 'console-devices', lang)
    })
  })
}

// Self-ordering, the station screens and the event's ordering modes.
const DIST = path.resolve(HERE, '../dist')
const PRICE = { bolo: 1200, veggie: 1200, kids: 700, pils: 220, cola: 220, pancake: 300 }

// A guest's phone: the menu with a few things picked, and the order page
// once the kitchen has it ready — side by side, as one picture.
async function selfOrderShot(browser: import('@playwright/test').Browser, lang: Lang) {
  const n = NAMES[lang]
  const phone = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, locale: BROWSER_LOCALE[lang], colorScheme: 'light' })
  const page = await phone.newPage()
  await page.addInitScript((l) => localStorage.setItem('arcanum-locale', l), lang)
  await page.route(/\/(bestel|volg)\//, (route) =>
    route.request().resourceType() === 'document' ? route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(DIST, 'selforder.html'), 'utf8') }) : route.fallback()
  )
  await page.routeWebSocket(/\/orders\/connect/, () => {})
  const entry = (key: keyof typeof PRICE) => ({ variantId: `v-${key}`, name: n.items[key], priceCents: PRICE[key] })
  await page.route(/\/api\/public\//, (route) => {
    const p = new URL(route.request().url()).pathname
    if (p.startsWith('/api/public/self-order/'))
      return route.fulfill({
        json: {
          eventName: n.event,
          orgName: n.org,
          locale: lang,
          open: true,
          modes: [
            {
              id: 'm-1',
              name: n.modes[0],
              payment: { counter: true, bancontact: true },
              catalog: {
                id: 'c',
                sections: [
                  { id: 's1', name: n.food, entries: [entry('bolo'), entry('veggie'), entry('kids')] },
                  { id: 's2', name: n.drinks, entries: [entry('pils'), entry('cola')] },
                  { id: 's3', name: n.desserts, entries: [entry('pancake')] },
                ],
              },
            },
          ],
        },
      })
    return route.fulfill({
      json: {
        number: 12, eventName: n.event, orgName: n.org, locale: lang, selfOrder: true, modeId: 'm-1', mode: null, payLater: false, tabOpen: false,
        state: 'ready', stations: [{ name: n.kitchen, status: 'ready' }, { name: n.bar, status: 'delivered' }],
        lines: [{ name: n.items.bolo, quantity: 2, unitPriceCents: 1200 }, { name: n.items.pils, quantity: 2, unitPriceCents: 220 }],
        totalCents: 2840, selfOrderCode: 'spaghetti-7kq2', hubTicket: null, payment: null, sms: null,
      },
    })
  })
  await page.goto('/bestel/spaghetti-7kq2')
  for (const [key, times] of [['bolo', 2], ['pils', 2]] as const) {
    for (let i = 0; i < times; i++) await page.getByTestId('menu-entry').filter({ hasText: n.items[key] }).getByRole('button').last().click()
  }
  await expect(page.getByTestId('to-cart')).toBeVisible()
  // No button caught hovered.
  await page.mouse.move(0, 0)
  const menu = await page.screenshot({ animations: 'disabled' })
  await page.goto('/volg/tok_abcdefghijklmnopqrstu')
  await expect(page.getByTestId('follow')).toHaveAttribute('data-state', 'ready')
  const ready = await page.screenshot({ animations: 'disabled' })
  await phone.close()

  // The two phones, on one 1024 × 640 picture like the other screenshots.
  const canvas = await browser.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 2 })
  const img = (png: Buffer) => `<img src="data:image/png;base64,${png.toString('base64')}">`
  await canvas.setContent(`<html><body style="margin:0;height:640px;display:flex;gap:56px;align-items:center;justify-content:center;background:#f4f4f5">
    <style>img{height:580px;border-radius:28px;border:6px solid #18181b;box-shadow:0 12px 32px rgba(0,0,0,.18)}</style>${img(menu)}${img(ready)}</body></html>`)
  await canvas.screenshot({ path: path.join(OUT, `selforder-${lang}.png`) })
  await canvas.close()
}

async function stationShot(page: Page, lang: Lang) {
  const n = NAMES[lang]
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  const t = (id: string, number: number, status: string, minutes: number, lines: [keyof typeof PRICE, number, string?][], extra = {}) => ({
    id, tabId: `tab-${id}`, status, createdAt: at(minutes), updatedAt: at(minutes), number, label: '', paid: true, selfOrder: false,
    lines: lines.map(([key, quantity, note]) => ({ name: n.items[key], quantity, voided: 0, note: note ?? null })), ...extra,
  })
  const tickets = [
    t('a', 9, 'in_progress', 9, [['bolo', 3], ['kids', 2]]),
    t('b', 10, 'in_progress', 7, [['veggie', 1, n.note], ['bolo', 1]], { selfOrder: true, mode: n.modes[1] }),
    t('c', 11, 'ordered', 4, [['bolo', 2]], { selfOrder: true }),
    t('d', 12, 'ordered', 2, [['kids', 1], ['veggie', 2]]),
    t('e', 8, 'ready', 12, [['bolo', 4]], { label: n.tables[0] }),
  ]
  await page.addInitScript((l) => {
    localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1', orgName: 'Scouts Kabouterland' }))
    localStorage.setItem('arcanum-locale', l)
  }, lang)
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/devices/ws-token') return route.fulfill({ json: { token: 'tok' } })
    if (p.endsWith('/devices/st-1')) return route.fulfill({ json: { terminal_id: 'st-1', org_id: 'org-1', role: 'station', station_id: 'st-k', station_name: n.kitchen } })
    if (p.endsWith('/stations/st-k/tickets')) return route.fulfill({ json: tickets })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/station.html')
  await expect(page.getByTestId('ticket')).toHaveCount(5)
  await shot(page, 'station', lang)
}

async function eventShot(open: (path: string) => Promise<Page>, catalogAdmin: FakeCatalogAdmin, lang: Lang) {
  const n = NAMES[lang]
  seedMenu(catalogAdmin, lang)
  const menu = catalogAdmin.catalogs[0]
  const mode = (id: string, name: string, extra = {}) => ({ id, name, catalogId: menu.id, selfOrder: true, payAtCounter: true, payBancontact: true, tabs: false, notifySms: false, ...extra })
  catalogAdmin.events = [
    {
      id: 'ev1', name: n.event, date: '2026-10-17', createdAt: '2026-10-01T10:00:00Z', sms: true, kassaModes: false, lastOrderNumber: 12,
      selfOrder: { enabled: true, code: 'spaghetti-7kq2', linkName: 'spaghetti' },
      modes: [mode('a1b2c3d4e5f6a7b8c9d0', n.modes[0], { tabs: true }), mode('f6e5d4c3b2a1f6e5d4c3', n.modes[1], { notifySms: true, payAtCounter: false })],
    },
  ]
  const page = await open('/events')
  await page.getByRole('row').filter({ hasText: n.event }).getByRole('button').last().click()
  await expect(page.getByRole('dialog').getByTestId('order-mode')).toBeVisible()
  // The installation's own address, not the test server's.
  await page.locator('#self-order-url').evaluate((el: HTMLTextAreaElement) => (el.value = 'https://kassa.scoutskabouterland.be/bestel/spaghetti-7kq2'))
  await page.mouse.move(0, 0)
  await shot(page, 'console-event', lang)
}

// The sign-in screen: on this device, with a phone (the QR code), or pairing a device.
async function signInShot(page: Page, lang: Lang) {
  await page.addInitScript((l) => localStorage.setItem('arcanum-locale', l), lang)
  await page.route(/\/device\/start$/, (route) =>
    route.fulfill({ json: { userCode: 'KBTR-7Q2M', verificationUriComplete: 'https://login.example/device?user_code=KBTR7Q2M', pollId: 'p1', interval: 30, expiresIn: 600 } })
  )
  await page.route(/\/device\/poll/, (route) => route.fulfill({ json: { status: 'pending' } }))
  await page.goto('/login-prompt.html')
  await expect(page.getByText('KBTR-7Q2M')).toBeVisible()
  await shot(page, 'sign-in', lang)
}

for (const lang of LANGS) {
  test.describe(`${lang}: self-ordering and stations`, () => {
    test.use({ locale: BROWSER_LOCALE[lang] })
    test('a guest orders and follows it on the phone', async ({ browser }) => selfOrderShot(browser, lang))
    test("the kitchen's station screen", async ({ page }) => stationShot(page, lang))
    test('the sign-in screen', async ({ page }) => signInShot(page, lang))
    test("an event's ordering modes in the console", async ({ console: open, catalogAdmin, page }) => {
      await page.route(/\/api\/organizations$/, (route) => route.fulfill({ json: [{ id: ORG_ID, name: 'Scouts Kabouterland', logoUrl: null, theme: null, createdAt: '2026-01-01' }] }))
      await page.route(/\/whoami$/, (route) => route.fulfill({ json: { sub: 'admin', email: 'an@scoutskabouterland.be', name: 'An Janssens', firstName: 'An', lastName: 'Janssens', username: 'an' } }))
      await eventShot(open, catalogAdmin, lang)
    })
  })
}
