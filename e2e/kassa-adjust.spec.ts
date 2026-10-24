import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Aanpassen (KASSA_REDESIGN.md, phase 4): how this kassa looks, kept on the
// device - product buttons, the ticket's side, counts, tip buttons, the
// language (a reload, so not while something isn't sent).

test.use({ viewport: { width: 1280, height: 800 } })

const sheet = (kassa: Page) => kassa.getByTestId('adjust-sheet')
const height = async (kassa: Page, name: RegExp) => Math.round((await kassa.getByRole('button', { name }).first().boundingBox())!.height)

test('product buttons and the ticket side: changed at once, kept on this device, Standaard puts them back', async ({ kassa }) => {
  const product = /^Wandeltocht \(lid\)/
  // The kassa behind an open sheet is hidden from assistive tech: choose, close, look.
  async function choose(group: string, option: string) {
    await kassa.getByTestId('adjust').click()
    await sheet(kassa).getByTestId(group).getByRole('button', { name: option }).click()
    await kassa.keyboard.press('Escape')
    await expect(sheet(kassa)).toHaveCount(0)
  }
  const x = async (testId: string) => (await kassa.getByTestId(testId).boundingBox())!.x

  // Compact tiles by default.
  expect(await height(kassa, product)).toBe(108)
  await choose('adjust-tiles', 'Lijst')
  expect(await height(kassa, product)).toBeLessThan(70)
  await choose('adjust-tiles', 'Groot')
  expect(await height(kassa, product)).toBe(128)

  // The ticket on the left: left of the menu.
  await choose('adjust-side', 'Links')
  expect(await x('tab-side')).toBeLessThan(await x('order-target'))

  await kassa.reload()
  expect(await height(kassa, product)).toBe(128)
  expect(await x('tab-side')).toBeLessThan(await x('order-target'))

  await kassa.getByTestId('adjust').click()
  await sheet(kassa).getByRole('button', { name: 'Standaard' }).click()
  await sheet(kassa).getByRole('button', { name: 'Gereed' }).click()
  await expect(sheet(kassa)).toHaveCount(0)
  expect(await height(kassa, product)).toBe(108)
  expect(await x('tab-side')).toBeGreaterThan(await x('order-target'))
})

test('counts and tip buttons can be switched off; the tip amount stays', async ({ kassa }) => {
  await kassa.getByRole('button', { name: /^Wandeltocht \(lid\)/ }).first().click()
  const count = kassa.getByRole('button', { name: /^Wandeltocht \(lid\)/ }).first().getByTestId('entry-count')
  await expect(count).toBeVisible()
  await expect(kassa.getByRole('button', { name: '+€1', exact: true })).toBeVisible()

  await kassa.getByTestId('adjust').click()
  await sheet(kassa).getByRole('switch', { name: 'Aantallen op de knoppen' }).click()
  await sheet(kassa).getByRole('switch', { name: 'Fooiknoppen' }).click()
  await kassa.keyboard.press('Escape')
  await expect(sheet(kassa)).toHaveCount(0)
  await expect(count).toBeHidden()
  await expect(kassa.getByRole('button', { name: '+€1', exact: true })).toHaveCount(0)
  await expect(kassa.getByLabel('Fooi', { exact: true })).toBeEnabled()
})

test('the language: not while something is not sent yet (it reloads the kassa)', async ({ kassa }) => {
  await kassa.getByRole('button', { name: /^Wandeltocht \(lid\)/ }).first().click()
  await kassa.getByTestId('adjust').click()
  await expect(sheet(kassa).getByRole('button', { name: 'Français' })).toBeDisabled()
  await expect(sheet(kassa)).toContainText('Stuur of reken eerst af')
  await kassa.keyboard.press('Escape')
  await expect(sheet(kassa)).toHaveCount(0)

  await kassa.getByRole('button', { name: 'Leegmaken', exact: true }).click()
  await kassa.getByTestId('adjust').click()
  await sheet(kassa).getByRole('button', { name: 'Français' }).click()
  await expect(kassa.getByText('Comptoir - payer directement')).toBeVisible()
})

// Phase 6: a group's colour chosen in the console wins; the others stay automatic.
test("a menu group in the colour chosen for it in the console", async ({ kassa, backend }) => {
  backend.catalogs[0].sections[1].color = '#15803d'
  await kassa.reload()
  const box = (name: string) => kassa.getByTestId('menu-group').filter({ has: kassa.getByRole('heading', { name }) })
  await expect(box('Bonnen')).toHaveCSS('--group', '#2563eb')
  await expect(box('Tochten')).toHaveCSS('--group', '#15803d')
})
