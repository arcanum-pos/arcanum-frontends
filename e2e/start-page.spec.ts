// The start page (root `/`, chooser.html): a device is paired only with a
// code from the console; a paired device opens its screen; one removed in
// the console says so and can be paired again. DOMAIN_MODEL.md "Devices:
// control plane and data plane".
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { guardCsp } from './csp-guard'

test.beforeEach(async ({ context }) => {
  guardCsp(context)
})

const KASSA = /\/kassa(\.html)?$/

// Stops at the kassa's URL — the kassa itself isn't under test here.
async function stopAtKassa(page: Page) {
  await page.route(KASSA, (route) => route.fulfill({ contentType: 'text/html', body: '<p>kassa</p>' }))
}

function storeTerminal(page: Page, terminal: Record<string, unknown>) {
  return page.addInitScript((t) => localStorage.setItem('arcanum-terminal', JSON.stringify(t)), terminal)
}

test('not paired: pair with a code, or go to the console — no role to pick', async ({ page }) => {
  await page.goto('/chooser.html')
  await expect(page.getByRole('heading', { name: 'Wat wil je doen?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dit toestel koppelen' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Naar de console' })).toHaveAttribute('href', '/console')
  await expect(page.getByRole('button', { name: /^Kassa/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Koppelen' })).toBeDisabled()
})

test("the console's QR fills in the code; pairing makes this browser that device and opens it", async ({ page }) => {
  const claimed: unknown[] = []
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, async (route) => {
    claimed.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { terminalId: 'pos-9', role: 'pos', orgId: 'org-1', orgName: 'Scouts Kabouterland', orgLocale: 'nl', name: 'Kassa toog' } })
  })
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=K7PM4XQ2')
  await expect(page.getByLabel('Koppelcode')).toHaveValue('K7PM4XQ2')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([{ code: 'K7PM4XQ2' }])
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-terminal')))!)).toEqual({
    terminalId: 'pos-9',
    role: 'pos',
    orgId: 'org-1',
    orgName: 'Scouts Kabouterland',
    name: 'Kassa toog',
  })
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-device')))!).name).toBe('Kassa toog')
})

test('a wrong code: the reason, and nothing stored', async ({ page }) => {
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, (route) =>
    route.fulfill({ status: 400, json: { error: 'x', code: 'pairing_code_invalid' } })
  )
  await page.goto('/chooser.html')
  await page.getByLabel('Koppelcode').fill('ABCD-EFGH')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Deze koppelcode klopt niet, is al gebruikt of is verlopen — vraag een beheerder om een nieuwe')
  expect(await page.evaluate(() => localStorage.getItem('arcanum-terminal'))).toBeNull()
})

test('a paired device opens its screen right away', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ json: { terminal_id: 'pos-1', org_id: 'org-1', role: 'pos' } }))
  await stopAtKassa(page)
  await page.goto('/chooser.html')
  await page.waitForURL(KASSA)
})

test('?start: a paired device shows itself instead, with "Openen"', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ json: { terminal_id: 'pos-1', org_id: 'org-1', role: 'pos' } }))
  await stopAtKassa(page)
  await page.goto('/chooser.html?start')
  await expect(page.getByRole('heading', { name: 'Dit toestel is Kassa 1' })).toBeVisible()
  await expect(page.getByText('Organisatie: Scouts')).toBeVisible()
  await page.getByRole('button', { name: 'Openen' }).click()
  await page.waitForURL(KASSA)
})

test('removed in the console: says so, forgets it, and offers pairing again', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ status: 404, json: { error: 'x', code: 'device_not_found' } }))
  await page.goto('/chooser.html')
  await expect(page.getByText('Dit toestel is niet meer gekoppeld (het werd verwijderd in de console).')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dit toestel koppelen' })).toBeVisible()
  // Gone from storage — but the init script puts it back on the next load, so check now.
  expect(await page.evaluate(() => localStorage.getItem('arcanum-terminal'))).toBeNull()
})
