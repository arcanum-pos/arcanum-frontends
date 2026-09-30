// Console → Instellingen. The per-org custom domain (Huisstijl) and login
// provider (Aanmelding) pages are gone (hosting plan phase 6): both belong
// to the instance now, set up in the installer. Every other settings page
// still opens.
import { expect, test } from './console-fixtures'

const PAGES = [
  ['Weergave', '/settings/appearance'],
  ['Voorkeuren', '/settings/preferences'],
  ['Profiel', '/settings/profile'],
  ['Betaalproviders', '/settings/payment-providers'],
  ['Meldingen', '/settings/notifications'],
  ['Gegevens', '/settings/data'],
] as const

test('the settings menu has no Huisstijl or Aanmelding anymore', async ({ console: open, page }) => {
  await open('/settings/appearance')
  const nav = page.locator('main nav').filter({ has: page.getByRole('link', { name: 'Weergave' }) })
  await expect(nav.getByRole('link')).toHaveText(PAGES.map(([name]) => name))
  await expect(page.getByRole('link', { name: 'Huisstijl' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Aanmelding' })).toHaveCount(0)
})

test('every remaining settings page opens from the menu', async ({ console: open, page }) => {
  await open('/settings/appearance')
  for (const [name, to] of PAGES) {
    await page.getByRole('link', { name, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/console${to}$`))
  }
})

test('the old page addresses show neither the domain nor the login-provider form', async ({ console: open, page }) => {
  for (const path of ['/settings/branding', '/settings/authentication']) {
    await open(path)
    await expect(page.getByText('Aangepast domein')).toHaveCount(0)
    await expect(page.getByText('Issuer-URL')).toHaveCount(0)
  }
})
