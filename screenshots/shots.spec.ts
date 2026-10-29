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
import { BROWSER_LOCALE, LANGS, NAMES, salesReport, salesTransactions, type Lang } from './sample'
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

      await page.getByTestId('more-menu').click()
      await page.getByRole('menuitem', { name: NAMES[lang].ui.overview }).click()
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
      catalogAdmin.transactions = salesTransactions(lang)
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

async function stationShot(page: Page, lang: Lang, withPrinter = false) {
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
  const printer = { id: 'pr-1', name: n.printer, brand: 'epson', connection: 'poll', host: null, port: null, deviceId: 'local_printer', paperMm: 80, pollInterval: 10, lastPollAt: new Date().toISOString(), stations: [{ id: 'st-k', name: n.kitchen }] }
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
    if (withPrinter && p.endsWith('/printers')) return route.fulfill({ json: [printer] })
    if (withPrinter && p.endsWith('/jobs')) return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/station.html')
  await expect(page.getByTestId('ticket')).toHaveCount(5)
  if (withPrinter) {
    await expect(page.getByTestId('printer-button')).toContainText(n.printer)
    await expect(page.getByTestId('printer-button')).toHaveAttribute('data-state', 'idle')
    await page.mouse.move(0, 0)
    const screen = await page.screenshot({ animations: 'disabled' })
    // The ticket the kitchen printer has just printed, laid on the screen.
    const row = (q: number, key: keyof typeof PRICE, note?: string) => `<div class="l"><b>${q}x</b> ${n.items[key]}</div>${note ? `<div class="note">${note}</div>` : ''}`
    const canvas = await page.context().newPage()
    await canvas.setViewportSize({ width: 1024, height: 640 })
    await canvas.setContent(`<html><body style="margin:0;width:1024px;height:640px;position:relative;overflow:hidden;font-family:'Courier New',monospace">
      <img src="data:image/png;base64,${screen.toString('base64')}" style="width:1024px;height:640px;position:absolute;inset:0">
      <style>.p{position:absolute;right:54px;top:336px;width:250px;background:#fff;color:#111;padding:18px 20px 26px;transform:rotate(2.5deg);box-shadow:0 14px 36px rgba(0,0,0,.28);font-size:14px;
        clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),95% 100%,90% calc(100% - 8px),85% 100%,80% calc(100% - 8px),75% 100%,70% calc(100% - 8px),65% 100%,60% calc(100% - 8px),55% 100%,50% calc(100% - 8px),45% 100%,40% calc(100% - 8px),35% 100%,30% calc(100% - 8px),25% 100%,20% calc(100% - 8px),15% 100%,10% calc(100% - 8px),5% 100%,0 calc(100% - 8px))}
        .big{font-size:34px;font-weight:700;text-align:center}.c{text-align:center}.hr{border-top:1px dashed #555;margin:8px 0}.l{margin:4px 0;font-size:15px}.note{margin-left:24px;font-size:13px}</style>
      <div class="p"><div class="c">${n.kitchen.toUpperCase()}</div><div class="big">#9</div><div class="c">${n.event}</div><div class="hr"></div>${row(3, 'bolo')}${row(2, 'kids')}${row(1, 'veggie', n.note)}<div class="hr"></div><div class="c">${n.modes[0]}</div></div></body></html>`)
    await canvas.screenshot({ path: path.join(OUT, `printing-${lang}.png`) })
    await canvas.close()
    return
  }
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
  await page.getByRole('menuitem').first().click() // Set up (the line's … menu)
  await expect(page.getByRole('dialog').getByTestId('order-mode').first()).toBeVisible()
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

// The kassa's kasopmaak (closing the drawer): what should be in it, what was
// counted per note and coin, who worked. Full size like the customer display:
// at 640 high the form runs off the screen. A 1707 × 1067 screen at
// 1.5x, so it is as large as the others.
const REGISTER = { nl: 'Toog', fr: 'Comptoir', en: 'Bar' }
const WORKERS = [
  { name: 'Sam', payments: 41 },
  { name: 'An', payments: 22 },
  { name: 'Bram', payments: 11 },
]
async function kasopmaakShot(page: Page, lang: Lang) {
  const backend = evening(lang)
  const now = Date.now()
  backend.shift = {
    id: 'shift-1', registerId: 'toog', number: 1, status: 'open', openedAt: new Date(now - 4 * 3600e3).toISOString(), openedBy: null, openingFloatCents: 5000,
    movements: [{ direction: 'out', amountCents: 1500, reason: { nl: 'IJs gekocht', fr: 'Glace achetée', en: 'Bought ice' }[lang], by: null, at: new Date(now - 90 * 60e3).toISOString() }],
  }
  backend.shiftCash = 41250
  backend.registers[0].name = REGISTER[lang]
  backend.shiftPeople = WORKERS
  await page.setViewportSize({ width: 1707, height: 1067 })
  await page.addInitScript((name) => localStorage.setItem('arcanum-register', JSON.stringify({ orgId: 'org-e2e', id: 'toog', name })), REGISTER[lang])
  await openKassa(page, backend, lang)
  await page.getByTestId('more-menu').click()
  await page.getByTestId('open-cash-up').click()
  const cashUp = page.getByTestId('cash-up')
  await expect(cashUp).toBeVisible()
  for (const [d, n] of [['€ 50', 3], ['€ 20', 8], ['€ 10', 10], ['€ 5', 4], ['€ 2', 6], ['€ 1', 5]] as const) await cashUp.getByLabel(d, { exact: true }).fill(String(n))
  await cashUp.locator('#cash-up-left').fill('50')
  await page.getByTestId('more-menu').evaluate((el) => (el as HTMLElement).blur())
  await cashUp.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await page.mouse.move(0, 0)
  await shot(page, 'kasopmaak', lang)
}

// The waiter's phone: the tables by zone and status, and a table's tab with
// its order, side by side on one picture like the self-ordering one.
const ZONES = { nl: ['Zaal', 'Terras'], fr: ['Salle', 'Terrasse'], en: ['Hall', 'Terrace'] }
async function waiterShot(browser: import('@playwright/test').Browser, lang: Lang) {
  const n = NAMES[lang]
  const phone = await browser.newContext({ viewport: { width: 430, height: 640 }, deviceScaleFactor: 2, locale: BROWSER_LOCALE[lang], colorScheme: 'light' })
  const page = await phone.newPage()
  await page.addInitScript((l) => localStorage.setItem('arcanum-locale', l), lang)
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const mk = (id: string, name: string, zone: string, position: number, state: 'free' | 'occupied' | 'clearing', tab: { total: number; min: number; preparing?: boolean } | null = null) => ({
    id: `t${id}`, name, zone, position, archived: false, state, qrToken: `qr-${id}`,
    tab: tab ? { id: `tab${id}`, number: 20 + position, label: '', openedAt: ago(tab.min), totalCents: tab.total, preparing: !!tab.preparing } : null,
  })
  const [hall, terrace] = ZONES[lang]
  const tables = [
    mk('1', '1', hall, 0, 'occupied', { total: 4640, min: 48 }),
    mk('2', '2', hall, 1, 'free'),
    mk('3', '3', hall, 2, 'occupied', { total: 2400, min: 12, preparing: true }),
    mk('4', '4', hall, 3, 'occupied', { total: 5380, min: 26, preparing: true }),
    mk('5', '5', hall, 4, 'clearing'),
    mk('6', '6', hall, 5, 'free'),
    mk('7', '7', terrace, 6, 'occupied', { total: 1780, min: 7 }),
    mk('8', '8', terrace, 7, 'free'),
    mk('9', '9', terrace, 8, 'clearing'),
  ]
  const l = (id: string, key: keyof typeof PRICE, quantity: number) => ({ id, orderId: 'o1', itemCode: null, name: n.items[key], unitPriceCents: PRICE[key], quantity, voidsLineId: null, voidReason: null, voidedQuantity: 0, createdAt: ago(20) })
  const lines = [l('l1', 'bolo', 2), l('l2', 'kids', 1), l('l3', 'pils', 2), l('l4', 'cola', 2), l('l5', 'pancake', 3)]
  const total = lines.reduce((t, x) => t + x.unitPriceCents * x.quantity, 0)
  tables[3].tab!.totalCents = total
  const tab = { id: 'tab4', number: 24, label: `${n.tables[0]}`, status: 'open', lines, totalCents: total, paidCents: 0, outstandingCents: total, paymentPending: false }
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/organizations/memberships') return route.fulfill({ json: [{ orgId: 'org-1', orgName: n.org, role: 'waiter' }] })
    if (p === '/api/organizations/org-1/events') return route.fulfill({ json: [{ id: 'ev1', name: n.event, date: null, modes: [{ id: 'm1', name: n.modes[0], catalogId: 'cat1', atTable: true }] }] })
    if (p === '/api/organizations/org-1/live-token') return route.fulfill({ json: { token: 'live' } })
    if (p === '/api/organizations/org-1/tables') return route.fulfill({ json: tables })
    if (p === '/api/organizations/org-1/tabs/tab4') return route.fulfill({ json: tab })
    if (p === '/api/organizations/org-1/receipt-settings') return route.fulfill({ json: { enabled: false } })
    if (p === '/api/organizations/org-1/promised-tables') return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/waiter.html')
  await expect(page.getByTestId('table')).toHaveCount(9)
  await page.mouse.move(0, 0)
  const grid = await page.screenshot({ animations: 'disabled' })
  await page.getByTestId('table').filter({ hasText: /^4/ }).click()
  await expect(page.getByTestId('tab-lines')).toContainText(n.items.pancake)
  await page.mouse.move(0, 0)
  const table = await page.screenshot({ animations: 'disabled' })
  await phone.close()

  const canvas = await browser.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 2 })
  const img = (png: Buffer) => `<img src="data:image/png;base64,${png.toString('base64')}">`
  await canvas.setContent(`<html><body style="margin:0;height:640px;display:flex;gap:56px;align-items:center;justify-content:center;background:#f4f4f5">
    <style>img{height:580px;border-radius:28px;border:6px solid #18181b;box-shadow:0 12px 32px rgba(0,0,0,.18)}</style>${img(grid)}${img(table)}</body></html>`)
  await canvas.screenshot({ path: path.join(OUT, `waiter-${lang}.png`) })
  await canvas.close()
}

// The ? on the kassa: the support form open as a dialog over the screen, with
// the screenshot it captured of it. The real form (support.kaboutersoft.be)
// is fetched and shown, on the same 1707 × 1067 screen as the kasopmaak's, filled in as a user would; only its Turnstile check
// is left out.
const REPORT = {
  nl: { title: 'Bon wordt niet geprint', text: 'Na het afrekenen van tafel 4 kwam er geen bon uit de keukenprinter. De printer staat aan en het lampje is groen.' },
  fr: { title: 'Le bon ne s’imprime pas', text: 'Après l’encaissement de la table 4, aucun bon n’est sorti de l’imprimante de la cuisine. Elle est allumée et le voyant est vert.' },
  en: { title: 'Ticket does not print', text: 'After charging table 4, no ticket came out of the kitchen printer. The printer is on and its light is green.' },
}
async function supportShot(page: Page, lang: Lang) {
  const backend = evening(lang)
  await page.setViewportSize({ width: 1707, height: 1067 })
  await page.route('https://support.kaboutersoft.be/**', async (route) => {
    const res = await route.fetch()
    if (!res.headers()['content-type']?.includes('text/html')) return route.fulfill({ response: res })
    const body = (await res.text()).replace(/<script[^>]*turnstile[^>]*><\/script>/, '').replace(/<div class="cf-turnstile"[^>]*><\/div>/, '')
    return route.fulfill({ response: res, body })
  })
  await openKassa(page, backend, lang)
  await page.context().route(/\/whoami$/, (route) => route.fulfill({ json: { name: 'Sam Peeters', email: 'sam@scoutskabouterland.be' } }))
  await openTab4(page)
  await page.getByTestId('support-button').click()
  const frame = page.frameLocator('[data-testid="support-frame"]')
  await expect(frame.locator('#shot-img')).toBeVisible()
  await expect.poll(() => frame.locator('#shot-img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
  await frame.locator('#title').fill(REPORT[lang].title)
  await frame.locator('#description').fill(REPORT[lang].text)
  // Scrolled to the kind of report at the top and the screenshot below.
  await frame.locator('#shot').scrollIntoViewIfNeeded()
  await frame.locator('#description').evaluate((el) => el.style.setProperty('min-height', '64px') || el.style.setProperty('height', '64px'))
  await frame.locator('body').evaluate(() => window.scrollTo(0, 0))
  await page.mouse.move(0, 0)
  await shot(page, 'support', lang)
}

for (const lang of LANGS) {
  test.describe(`${lang}: kasopmaak, printing, waiter, support`, () => {
    test.use({ locale: BROWSER_LOCALE[lang] })
    test('the waiter: tables and a table', async ({ browser }) => waiterShot(browser, lang))
    test("the station screen's printer", async ({ page }) => stationShot(page, lang, true))
    test.describe('at 1.5x', () => {
      test.use({ deviceScaleFactor: 1.5 })
      test('the kasopmaak', async ({ page }) => kasopmaakShot(page, lang))
      test('the support form over the kassa', async ({ page }) => supportShot(page, lang))
    })
  })
}
