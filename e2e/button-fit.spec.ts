// Every button keeps its text inside (button-fit.ts): the kassa in its main
// states and dialogs, its settings, the customer display and every console
// page — in Dutch, French and English (French texts are usually the
// longest), on a small and a larger tablet. The phone and station screens
// check it in their own specs.
import { expect, type Page, type WebSocketRoute } from '@playwright/test'
import { eveningCatalog, line, NAMES } from '../screenshots/sample'
import { overflowingButtons } from './button-fit'
import { test } from './console-fixtures'
import { FakeBackend } from './fake-backend'

const LANGS = [
  ['nl', 'nl-BE', 'Annuleren'],
  ['fr', 'fr-BE', 'Annuler'],
  ['en', 'en-GB', 'Cancel'],
] as const
const CONSOLE = ['/', '/dashboard', '/reports', '/events', '/products', '/catalogs', '/devices', '/users', '/staff', '/registers', '/tables', '/settings', '/settings/appearance', '/settings/preferences', '/settings/profile', '/settings/payment-providers', '/settings/data']

async function fits(page: Page, where: string) {
  expect(await overflowingButtons(page), `button text running over: ${where}`).toEqual([])
}

async function openKassa(page: Page, backend: FakeBackend, lang: string) {
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.addInitScript((l) => {
    localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'pos-1', role: 'pos', orgId: 'org-e2e', orgName: 'Scouts Kabouterland' }))
    localStorage.setItem('arcanum-locale', l)
    localStorage.setItem('arcanum-device', JSON.stringify({ id: 'k1', name: 'Kassa 1' }))
  }, lang)
  await page.context().route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/kassa.html')
}

for (const [lang, locale, voidLabel] of LANGS) {
  for (const [width, height] of [
    [1024, 640],
    [1280, 800],
  ]) {
    test.describe(`${lang}, ${width}×${height}`, () => {
      test.use({ locale, viewport: { width, height } })

      test('kassa, its settings and the customer display', async ({ page }) => {
        const names = NAMES[lang]
        const backend = new FakeBackend()
        backend.catalogs = [eveningCatalog(lang)]
        backend.devices.set('pos-1', { terminal_id: 'pos-1', org_id: 'org-e2e', role: 'pos', linked_to: null, name: 'Kassa 1' })
        backend.openTab(names.tables[0], [line(lang, 'pils', 2), line(lang, 'bolo', 2)])
        await openKassa(page, backend, lang)
        await expect(page.getByText(names.ui.quick).first()).toBeVisible()
        await fits(page, 'kassa, Toog')

        await page.getByRole('button', { name: /^#1 / }).click()
        await page.getByRole('button', { name: new RegExp(`^${names.items.pancake}`) }).first().click()
        await expect(page.getByTestId('draft-line')).toHaveCount(1)
        await fits(page, 'kassa, a tab with a round')

        await page.getByTestId('tab-panel').getByRole('button', { name: voidLabel, exact: true }).first().click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await fits(page, 'kassa, void dialog')
        await page.keyboard.press('Escape')

        await page.getByTestId('tab-panel').getByRole('button', { name: names.ui.split, exact: true }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await fits(page, 'kassa, split dialog')
        await page.keyboard.press('Escape')

        await page.locator('button.border-dashed').click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await fits(page, 'kassa, new tab dialog')
        await page.keyboard.press('Escape')

        await page.getByRole('radio').nth(1).check()
        await page.getByRole('button', { name: new RegExp(`^${names.ui.pay} €`) }).click()
        await expect(page.getByTestId('tab-panel')).toHaveCount(0)
        await fits(page, 'kassa, paying cash')

        await page.goto('/kassa.html')
        await page.getByRole('button', { name: names.ui.overview }).click()
        await expect(page.getByTestId('overview-row').first()).toBeVisible()
        await fits(page, 'kassa, Rekeningen')

        await page.goto('/settings.html')
        await expect(page.locator('main, body').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await fits(page, 'kassa settings')

        const display = await page.context().newPage()
        await display.routeWebSocket(/\/devices\/connect/, () => {})
        await display.goto('/display.html?terminal=cfd-1')
        await display.waitForLoadState('networkidle')
        await fits(display, 'customer display')
      })

      test('console', async ({ console: open }) => {
        for (const route of CONSOLE) {
          const page = await open(route)
          await page.waitForLoadState('networkidle')
          await fits(page, `console ${route}`)
        }
      })
    })
  }
}

test('the check itself: text running over a fixed-size button is found; cut off with an ellipsis, a switch, or fitting is not', async ({ page }) => {
  await page.setContent(`
    <button style="height:38px;width:120px;font-size:13px">Bestelling toevoegen aan rekening</button>
    <button style="height:38px;width:120px;white-space:nowrap">Bestelling toevoegen aan rekening</button>
    <button style="height:38px;width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Bestelling toevoegen aan rekening</button>
    <button role="switch" style="height:16px;width:30px"><span style="display:block;width:42px;height:24px"></span></button>
    <button style="min-height:38px;width:120px">Past wel</button>`)
  const found = await overflowingButtons(page)
  expect(found).toHaveLength(2)
  expect(found.every((f) => f.startsWith('"Bestelling toevoegen aan rekening"'))).toBe(true)
})
