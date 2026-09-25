// AGPL-3.0 §13: every installation offers its users the source of what it
// runs. The console footer's "Broncode" link follows arcanum-bff's
// /version source_url (the installation's SOURCE_URL setting).
import { expect, test } from './console-fixtures'

test("the Broncode link follows the installation's source URL", async ({ console: open, page }) => {
  await page.route('**/version', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 'x', source_url: 'https://github.com/example/arcanum-fork' }) })
  )
  await open('/products')
  await expect(page.getByRole('link', { name: 'Broncode' })).toHaveAttribute('href', 'https://github.com/example/arcanum-fork')
})

test('the Broncode link falls back to the upstream repos when /version has none', async ({ console: open, page }) => {
  await page.route('**/version', (route) => route.fulfill({ status: 404, body: '' }))
  await open('/products')
  await expect(page.getByRole('link', { name: 'Broncode' })).toHaveAttribute('href', 'https://github.com/arcanum-pos')
})

test('the footer shows the installed release, or "main" when deployed from the repos', async ({ console: open, page }) => {
  let body: Record<string, unknown> = { version: 'x', release: '0.1.4' }
  await page.route('**/version', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
  await open('/products')
  await expect(page.getByTestId('app-version')).toHaveText('Arcanum 0.1.4')
  body = { version: 'x', release: null }
  await page.reload()
  await expect(page.getByTestId('app-version')).toHaveText('Arcanum main')
})

test('the footer shows no version when /version does not answer', async ({ console: open, page }) => {
  await page.route('**/version', (route) => route.fulfill({ status: 404, body: '' }))
  await open('/products')
  await expect(page.getByRole('link', { name: 'Broncode' })).toBeVisible()
  await expect(page.getByTestId('app-version')).toHaveCount(0)
})
