// The kassa's Instellingen: the device's name goes to the organisation's
// list too; an admin gets "Beheer" — the console in a new tab, and
// unpairing this device. A cashier gets neither (DOMAIN_MODEL.md "Devices").
import { expect, test } from './fixtures'
import type { FakeBackend } from './fake-backend'

async function openSettings(kassa: import('@playwright/test').Page) {
  await kassa.goto('/settings.html')
  await expect(kassa.getByRole('heading', { name: 'Instellingen' })).toBeVisible()
}

test('a cashier: no Beheer', async ({ kassa }) => {
  await openSettings(kassa)
  await expect(kassa.getByText('Catalogus').or(kassa.getByText('Menukaart')).first()).toBeVisible()
  await expect(kassa.getByTestId('manage')).toHaveCount(0)
})

test("the device's name is saved in the organisation's list too", async ({ kassa, backend }) => {
  await openSettings(kassa)
  await kassa.getByPlaceholder('bv. Kassa 1').fill('Kassa toog')
  await kassa.getByRole('button', { name: 'Naam opslaan' }).click()
  await expect(kassa.getByText('Naam van dit toestel opgeslagen.')).toBeVisible()
  expect(backend.devices.get('pos-e2e')!.name).toBe('Kassa toog')
})

test('an admin: the console in a new tab, and unpairing this device', async ({ kassa, backend }) => {
  ;(backend as FakeBackend).memberRole = 'admin'
  await openSettings(kassa)
  const manage = kassa.getByTestId('manage')
  await expect(manage.getByRole('link', { name: 'Beheer (console)' })).toHaveAttribute('target', '_blank')
  await kassa.route(/\/$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>start</p>' }))
  kassa.once('dialog', (d) => {
    expect(d.message()).toContain('ontkoppelen?')
    d.accept()
  })
  await manage.getByRole('button', { name: 'Dit toestel ontkoppelen' }).click()
  await kassa.waitForURL((url) => url.pathname === '/')
  expect(backend.devices.has('pos-e2e')).toBe(false)
  // (The stored identity is cleared too — terminal.ts unpairThisDevice — but
  // the kassa fixture puts it back on every load, so it can't be checked here.)
})
