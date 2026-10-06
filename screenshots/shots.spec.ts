// The website's screenshots (npm run screenshots, playwright.screenshots.config.ts):
// the kassa, the customer display and the console with a scouts group's
// spaghetti evening as sample data (sample.ts), in Dutch, French and English. Each is written as
// <name>-<lang>.png to SHOTS_DIR (default: the website's public/screenshots).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page, WebSocketRoute } from '@playwright/test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { expect, test } from '../e2e/console-fixtures'
import { FakeBackend } from '../e2e/fake-backend'
import { ORG_ID, type FakeCatalogAdmin } from '../e2e/fake-catalog-admin'
import { BROWSER_LOCALE, eveningCatalog, LANGS, line, NAMES, salesReport, type Lang } from './sample'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.SHOTS_DIR ?? path.resolve(HERE, '../../arcanum-bootstrapper/public/screenshots')
mkdirSync(OUT, { recursive: true })

const shot = (page: Page, name: string, lang: Lang) => page.screenshot({ path: path.join(OUT, `${name}-${lang}.png`), animations: 'disabled' })

// A real QR code for the customer display (the fake's is a black square).
// React leaves out the xmlns a standalone SVG image needs.
const qrSvg = renderToStaticMarkup(createElement(QRCodeSVG, { value: 'https://payconiq.com/pay/2/arcanum-demo-0001', size: 256, marginSize: 2 })).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
const QR = `data:image/svg+xml,${encodeURIComponent(qrSvg)}`

// The kassa on a fake backend, as kassa-*.spec.ts's fixture sets it up, but
// in the device language `lang` (arcanum-locale).
async function openKassa(page: Page, backend: FakeBackend, lang: Lang) {
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.addInitScript((locale) => {
    localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'pos-1', role: 'pos', orgId: 'org-e2e', orgName: 'Scouts Kabouterland' }))
    localStorage.setItem('arcanum-locale', locale)
    localStorage.setItem('arcanum-device', JSON.stringify({ id: 'k1', name: { nl: 'Kassa 1', fr: 'Caisse 1', en: 'Till 1' }[locale] }))
  }, lang)
  await page.context().route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  // Whoever is signed in on the kassa.
  await page.context().route(/\/whoami$/, (route) => route.fulfill({ json: { name: 'Sam Peeters', email: 'sam@example.test' } }))
  await page.goto('/kassa.html')
  await expect(page.getByText(NAMES[lang].ui.quick)).toBeVisible()
}

// The spaghetti evening: three open tabs, one already paid.
function evening(lang: Lang) {
  const backend = new FakeBackend()
  backend.catalogs = [eveningCatalog(lang)]
  const [t4, t7, name, terrace] = NAMES[lang].tables
  backend.openTab(t4, [line(lang, 'pils', 2), line(lang, 'cola', 2), line(lang, 'bolo', 2), line(lang, 'kids', 2), line(lang, 'pancake', 2)])
  backend.openTab(t7, [line(lang, 'wine', 2), line(lang, 'veggie', 1), line(lang, 'bolo', 1)])
  backend.openTab(name, [line(lang, 'pils', 1), line(lang, 'bolo', 1), line(lang, 'kids', 3), line(lang, 'cola', 3)])
  const paid = backend.openTab(terrace, [line(lang, 'pils', 4), line(lang, 'bolo', 4), line(lang, 'mousse', 2)])
  backend.resolveCharge(backend.startCharge(paid.id, 'bancontact').id, true)
  // Opened over the evening, on two kassa's.
  const till = { nl: 'Kassa', fr: 'Caisse', en: 'Till' }[lang]
  backend.tabs.forEach((tab, i) => {
    tab.openedAt = new Date(Date.now() - (95 - i * 22) * 60_000).toISOString()
    tab.openedDeviceName = `${till} ${i % 2 ? 2 : 1}`
  })
  return backend
}

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
        { terminal_id: 'pos-7f3a9c21', role: 'pos', linked_to: null, created_at: new Date(now - 9 * 86400e3).toISOString(), online: true },
        { terminal_id: 'pos-b81e44d0', role: 'pos', linked_to: null, created_at: new Date(now - 9 * 86400e3).toISOString(), online: true },
        { terminal_id: 'cfd-25c0e7aa', role: 'cfd', linked_to: 'pos-7f3a9c21', created_at: new Date(now - 8 * 86400e3).toISOString(), online: true },
      ]
      page = await open('/devices')
      await expect(page.getByText('rdr_3KQ8Z2V7XWJ4')).toBeVisible()
      await shot(page, 'console-devices', lang)
    })
  })
}

// The evening's products and menu, through the fake's own API (as console-catalog.spec.ts does).
function seedMenu(admin: FakeCatalogAdmin, lang: Lang) {
  const call = (method: string, p: string, body?: unknown): any => {
    const res = admin.handle(method, `/api/organizations/${ORG_ID}${p}`, body ?? null)
    if (res.status >= 300) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(res.body)}`)
    return res.body
  }
  const menu = eveningCatalog(lang)
  const catalog = call('POST', '/catalogs', { name: menu.name })
  for (const section of menu.sections) {
    const category = call('POST', '/catalog/categories', { name: section.name })
    const s = call('POST', `/catalogs/${catalog.id}/sections`, { name: section.name })
    for (const entry of section.entries) {
      const product = call('POST', '/catalog/products', { name: entry.name, categoryId: category.id })
      call('POST', `/catalogs/${catalog.id}/entries`, { sectionId: s.id, variantId: product.variants[0].id, priceCents: entry.priceCents })
    }
  }
}

