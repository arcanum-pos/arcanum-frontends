import { expect, test } from './console-fixtures'

// The console speaks the admin's own pick (Settings → Preferences, kept in
// arcanum-admin-locale), else the browser's language, else Dutch — and a
// switch applies at once, without a reload.

test('Preferences: switching the language applies at once and is remembered', async ({ console: open, page }) => {
  await open('/settings/preferences')
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')

  await page.getByRole('combobox', { name: 'Taal', exact: true }).click()
  await page.getByRole('option', { name: 'Français' }).click()
  await expect(page.getByRole('link', { name: 'Produits' }).first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  expect(await page.evaluate(() => localStorage.getItem('arcanum-admin-locale'))).toBe('fr')

  await page.goto('/console/products')
  await expect(page.getByRole('heading', { level: 1, name: 'Produits' })).toBeVisible()
})

test.describe('browser in English', () => {
  test.use({ locale: 'en-GB' })

  test("the console follows the browser, and the kassa's device language is left alone", async ({ console: open, page }) => {
    await open('/products')
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Source code' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('arcanum-locale'))).toBeNull()
  })
})

test("Preferences: the organisation's own language is saved on the organisation", async ({ console: open, page, orgTransfer }) => {
  await open('/settings/preferences')
  await page.getByRole('combobox', { name: 'Taal van de organisatie' }).click()
  await page.getByRole('option', { name: 'Français' }).click()
  await expect(page.getByText('Opgeslagen.')).toBeVisible()
  expect(orgTransfer.calls.filter((c) => c.path.endsWith('/locale'))).toEqual([{ path: '/api/organizations/org-e2e/locale', body: { locale: 'fr' }, status: 200 }])
  // Only the org's default — the console itself stays in the admin's language.
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
})
