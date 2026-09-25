// Self-hosted installations have arcanum-installer behind arcanum-bff at
// /installer/; /version says so, and the console links it.
import { expect, test } from './console-fixtures'

test('the Installatie link shows when /version says the installer is there', async ({ console: open, page }) => {
  await page.route('**/version', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 'x', source_url: 'https://github.com/arcanum-pos', installer: true }) })
  )
  await open('/products')
  await expect(page.getByRole('link', { name: 'Installatie' })).toHaveAttribute('href', '/installer/')
})

test('no Installatie link without the installer', async ({ console: open, page }) => {
  await page.route('**/version', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 'x', installer: false }) })
  )
  await open('/products')
  await expect(page.getByRole('link', { name: 'Producten' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Installatie' })).toHaveCount(0)
})
