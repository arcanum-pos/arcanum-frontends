// A design review pack (REVIEW_DIR=… npm run screenshots -- review-pack):
// the kassa, the customer display and the console in their real states,
// filled with the spaghetti evening (sample.ts) — at the sizes they're used
// on, light and dark, a few in French (the longest texts). Each screen as a
// PNG and as HTML (its CSS inlined, no scripts), so a design tool can read
// its structure and texts, not just the pixels. Skipped without REVIEW_DIR.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from '../e2e/console-fixtures'
import { ORG_ID } from '../e2e/fake-catalog-admin'
import { NAMES, salesReport, type Lang } from './sample'
import { evening, openKassa, QR, seedMenu } from './scenes'

const OUT = process.env.REVIEW_DIR
test.skip(!OUT, 'REVIEW_DIR not set')

async function snapshot(page: Page): Promise<string> {
  return page.evaluate(() => {
    const css = [...document.styleSheets]
      .map((sheet) => {
        try {
          return [...sheet.cssRules].map((r) => r.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .join('\n')
    const clone = document.documentElement.cloneNode(true) as HTMLElement
    clone.querySelectorAll('script, link[rel="stylesheet"], link[rel="modulepreload"], link[rel="manifest"]').forEach((e) => e.remove())
    const style = document.createElement('style')
    style.textContent = css
    clone.querySelector('head')!.appendChild(style)
    return `<!doctype html>\n${clone.outerHTML}`
  })
}

async function shot(page: Page, area: string, name: string) {
  const dir = path.join(OUT!, area)
  mkdirSync(dir, { recursive: true })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' })
  writeFileSync(path.join(dir, `${name}.html`), await snapshot(page))
}

const TABLET = { width: 1280, height: 800 }
const SMALL_TABLET = { width: 1024, height: 640 }

async function kassaOn(page: Page, lang: Lang, viewport = TABLET, dark = false, register = false) {
  await page.setViewportSize(viewport)
  if (dark) await page.emulateMedia({ colorScheme: 'dark' })
  if (register) await page.addInitScript(() => localStorage.setItem('arcanum-register', JSON.stringify({ orgId: 'org-e2e', id: 'toog', name: 'Toog' })))
  const backend = evening(lang)
  await openKassa(page, backend, lang)
  return backend
}

const openTab4 = (page: Page) => page.getByRole('button', { name: /^#1 / }).click()
const product = (page: Page, lang: Lang, key: keyof (typeof NAMES)['nl']['items']) => page.getByRole('button', { name: new RegExp(`^${NAMES[lang].items[key]}`) }).first()

test.describe('kassa', () => {
  test('the main flow', async ({ page }) => {
    const lang = 'nl'
    await kassaOn(page, lang)
    await shot(page, 'kassa', '01-toog-empty')
    await product(page, lang, 'pils').click()
    await product(page, lang, 'pils').click()
    await product(page, lang, 'bolo').click()
    await shot(page, 'kassa', '02-toog-order')
    await page.getByRole('button', { name: /^#1 / }).click()
    await expect(page.getByTestId('tab-panel')).toContainText(NAMES[lang].items.pancake)
    await shot(page, 'kassa', '03-tab-open')
    await product(page, lang, 'mousse').click()
    await product(page, lang, 'cola').click()
    await expect(page.getByTestId('draft-line')).toHaveCount(2)
    await shot(page, 'kassa', '04-tab-new-round')
    await page.locator('button.border-dashed').click()
    await shot(page, 'kassa', '05-dialog-new-tab')
    await page.keyboard.press('Escape')
    await page.getByTestId('tab-panel').getByRole('button', { name: 'Annuleren', exact: true }).first().click()
    await shot(page, 'kassa', '06-dialog-void-line')
    await page.keyboard.press('Escape')
    await page.getByTestId('tab-panel').getByRole('button', { name: 'Splitsen', exact: true }).click()
    await shot(page, 'kassa', '07-dialog-split-equal')
    await page.getByRole('dialog').getByRole('tab', { name: 'Per item' }).click()
    await shot(page, 'kassa', '08-dialog-split-per-item')
    await page.getByRole('dialog').getByRole('button', { name: 'Items kiezen' }).click()
    await shot(page, 'kassa', '09-split-per-item-picking')
  })

  test('paying', async ({ page }) => {
    const lang = 'nl'
    await kassaOn(page, lang)
    await openTab4(page)
    await page.getByLabel('Contant').check()
    await page.getByRole('button', { name: /^Afrekenen €/ }).click()
    await shot(page, 'kassa', '10-paying-cash')
    await page.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
    await shot(page, 'kassa', '11-paid-next-customer')
    await page.getByRole('button', { name: /Volgende klant/ }).click()
    await page.getByRole('button', { name: /^#2 / }).click()
    await page.getByLabel('Bancontact').check()
    await page.getByRole('button', { name: /^Afrekenen €/ }).click()
    await page.waitForTimeout(400)
    await page.locator('img[src^="data:image"], img[alt*="QR"]').evaluateAll((imgs, src) => imgs.forEach((i) => ((i as HTMLImageElement).src = src)), QR)
    await shot(page, 'kassa', '12-paying-bancontact')
  })

  test('the rest of the kassa', async ({ page }) => {
    const lang = 'nl'
    await kassaOn(page, lang)
    await page.getByRole('button', { name: NAMES[lang].ui.overview }).click()
    await expect(page.getByTestId('overview-row').first()).toBeVisible()
    await shot(page, 'kassa', '13-rekeningen-overview')
    await page.goto('/kassa.html')
    await page.getByTestId('staff-button').click()
    await shot(page, 'kassa', '14-staff-picker')
    await page.goto('/settings.html')
    await page.waitForLoadState('networkidle')
    await shot(page, 'kassa', '17-kassa-settings')
  })

  test('the register: opening, cash-up', async ({ page }) => {
    await kassaOn(page, 'nl', TABLET, false, true)
    await expect(page.getByTestId('open-register')).toBeVisible()
    await shot(page, 'kassa', '15-register-open-drawer')
    await page.getByTestId('open-register').getByRole('button', { name: 'Kassa openen', exact: true }).click()
    await page.getByTestId('open-cash-up').click()
    await expect(page.getByTestId('cash-up')).toBeVisible()
    await shot(page, 'kassa', '16-cash-up')
  })

  test('variants: dark, small tablet, French', async ({ page }) => {
    await kassaOn(page, 'nl', TABLET, true)
    await openTab4(page)
    await product(page, 'nl', 'mousse').click()
    await shot(page, 'kassa', '04-tab-new-round-dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize(SMALL_TABLET)
    await shot(page, 'kassa', '04-tab-new-round-1024x640')
  })

  test('French', async ({ page }) => {
    const lang = 'fr'
    await kassaOn(page, lang)
    await openTab4(page)
    await product(page, lang, 'mousse').click()
    await shot(page, 'kassa', '04-tab-new-round-fr')
    await page.getByTestId('tab-panel').getByRole('button', { name: NAMES[lang].ui.split, exact: true }).click()
    await shot(page, 'kassa', '07-dialog-split-fr')
  })
})

// The customer display beside a kassa on the same machine (its second window).
async function displayFor(page: Page, lang: Lang, branded: boolean, dark = false) {
  const backend = await kassaOn(page, lang)
  if (branded) {
    backend.events = [{ id: 'ev-1', name: NAMES[lang].event, date: '2026-10-24' }] as never
    backend.branding = { primary: '#1f6b3a', accent: '#f2c500', logoUrl: '/api/public/branding/org-e2e/logo.png?v=1' }
    await page.evaluate((name) => localStorage.setItem('arcanum-event', JSON.stringify({ id: 'ev-1', name, date: '2026-10-24' })), NAMES[lang].event)
    await page.reload()
  }
  const display = await page.context().newPage()
  await display.setViewportSize(TABLET)
  if (dark) await display.emulateMedia({ colorScheme: 'dark' })
  await display.routeWebSocket(/\/devices\/connect/, () => {})
  await display.route(/\/logo\.png/, async (route) => route.fulfill({ contentType: 'image/png', body: await logoPng(display) }))
  await display.goto('/display.html?terminal=cfd-1')
  await expect(display.getByTestId('cfd-idle')).toBeVisible()
  return display
}

// A stand-in logo for the branded shots: a white badge with the group's initials.
let logo: Buffer | null = null
async function logoPng(page: Page): Promise<Buffer> {
  if (logo) return logo
  const other = await page.context().newPage()
  await other.goto('about:blank')
  const b64 = await other.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 120
    c.height = 120
    const x = c.getContext('2d')!
    x.fillStyle = '#ffffff'
    x.beginPath()
    x.arc(60, 60, 56, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = '#1f6b3a'
    x.font = 'bold 54px sans-serif'
    x.textAlign = 'center'
    x.fillText('SK', 60, 79)
    return c.toDataURL('image/png').split(',')[1]
  })
  await other.close()
  return (logo = Buffer.from(b64, 'base64'))
}

for (const branded of [false, true]) {
  test(`customer display${branded ? ', branded' : ''}`, async ({ page }) => {
    const lang = 'nl'
    const display = await displayFor(page, lang, branded)
    const tag = branded ? '-branded' : ''
    await shot(display, 'cfd', `01-idle${tag}`)
    await openTab4(page)
    await product(page, lang, 'mousse').click()
    await expect(display.getByTestId('cfd-entering')).toBeVisible()
    await shot(display, 'cfd', `02-order-being-entered${tag}`)
    await page.getByLabel('Bancontact').check()
    await page.getByRole('button', { name: /^Afrekenen €/ }).click()
    const qr = display.getByTestId('cfd-waiting').locator('img')
    await expect(qr.first()).toBeVisible()
    await qr.last().evaluate((img: HTMLImageElement, src) => (img.src = src), QR)
    await shot(display, 'cfd', `03-paying-bancontact${tag}`)
    await page.goto('/kassa.html')
    await page.getByRole('button', { name: /^#2 / }).click()
    await page.getByLabel('Contant').check()
    await page.getByRole('button', { name: /^Afrekenen €/ }).click()
    await expect(display.getByTestId('cfd-waiting')).toBeVisible()
    await shot(display, 'cfd', `04-paying-cash${tag}`)
    await page.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
    await expect(display.getByTestId('cfd-paid')).toBeVisible()
    await shot(display, 'cfd', `05-paid${tag}`)
  })
}

test('customer display: dark, portrait', async ({ page }) => {
  const display = await displayFor(page, 'nl', false, true)
  await openTab4(page)
  await expect(display.getByTestId('cfd-entering')).toBeVisible()
  await shot(display, 'cfd', '02-order-being-entered-dark')
  await display.emulateMedia({ colorScheme: 'light' })
  await display.setViewportSize({ width: 800, height: 1280 })
  await shot(display, 'cfd', '02-order-being-entered-portrait')
})

const DESKTOP = { width: 1440, height: 900 }

test('console', async ({ console: open, catalogAdmin, page }) => {
  const lang: Lang = 'nl'
  const n = NAMES[lang]
  await page.setViewportSize(DESKTOP)
  await page.route(/\/api\/organizations$/, (route) => route.fulfill({ json: [{ id: ORG_ID, name: n.org, logoUrl: null, theme: null, createdAt: '2026-01-01' }] }))
  await page.route(/\/whoami$/, (route) => route.fulfill({ json: { sub: 'admin', email: 'an@scoutskabouterland.be', name: 'An Janssens', firstName: 'An', lastName: 'Janssens', username: 'an' } }))
  seedMenu(catalogAdmin, lang)
  catalogAdmin.salesReport = { ...catalogAdmin.salesReport, ...salesReport(lang) }
  const menu = catalogAdmin.catalogs[0]
  const mode = (id: string, name: string, extra = {}) => ({ id, name, catalogId: menu.id, selfOrder: true, payAtCounter: true, payBancontact: true, tabs: false, notifySms: false, ...extra })
  catalogAdmin.events = [
    {
      id: 'ev1', name: n.event, date: '2026-10-17', createdAt: '2026-10-01T10:00:00Z', sms: true, kassaModes: false, lastOrderNumber: 12,
      selfOrder: { enabled: true, code: 'spaghetti-7kq2', linkName: 'spaghetti' },
      modes: [mode('a1b2c3d4e5f6a7b8c9d0', n.modes[0], { tabs: true }), mode('f6e5d4c3b2a1f6e5d4c3', n.modes[1], { notifySms: true, payAtCounter: false })],
    },
  ]
  const now = Date.now()
  catalogAdmin.orgDevices = [
    { terminal_id: 'pos-7f3a9c21', role: 'pos', linked_to: null, created_at: new Date(now - 9 * 86400e3).toISOString(), online: true, name: `${n.readers[0]} 1` },
    { terminal_id: 'cfd-25c0e7aa', role: 'cfd', linked_to: 'pos-7f3a9c21', created_at: new Date(now - 8 * 86400e3).toISOString(), online: true, name: n.display },
  ]
  catalogAdmin.branding = { primary: '#1f6b3a', accent: '#f2c500', logo: null }

  const pages: [string, string][] = [
    ['01-start', '/'],
    ['02-dashboard', '/dashboard'],
    ['03-reports', '/reports'],
    ['04-events', '/events'],
    ['06-products', '/products'],
    ['07-catalogs', '/catalogs'],
    ['08-catalog-editor', `/catalogs/${menu.id}`],
    ['09-devices', '/devices'],
    ['10-users', '/users'],
    ['11-staff', '/staff'],
    ['12-registers', '/registers'],
    ['13-tables', '/tables'],
    ['14-settings-organisation', '/settings'],
    ['15-settings-appearance', '/settings/appearance'],
    ['16-settings-preferences', '/settings/preferences'],
    ['17-settings-payment-providers', '/settings/payment-providers'],
    ['18-settings-data', '/settings/data'],
  ]
  for (const [name, route] of pages) {
    const p = await open(route)
    await p.waitForLoadState('networkidle')
    await shot(p, 'console', name)
    if (name === '04-events') {
      await p.getByRole('row').filter({ hasText: n.event }).getByRole('button', { name: 'Instellen' }).click()
      await shot(p, 'console', '05-event-settings-dialog')
      await p.keyboard.press('Escape')
    }
  }
  await page.emulateMedia({ colorScheme: 'dark' })
  const p = await open(`/catalogs/${menu.id}`)
  await p.waitForLoadState('networkidle')
  await shot(p, 'console', '08-catalog-editor-dark')
})
