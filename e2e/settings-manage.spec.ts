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

test('linking a customer display: by name, not by id', async ({ kassa, backend }) => {
  backend.devices.set('cfd-7', { terminal_id: 'cfd-7', org_id: 'org-e2e', role: 'cfd', linked_to: null, name: 'Tablet toog' })
  await openSettings(kassa)
  const row = kassa.locator('div.rounded-md').filter({ hasText: 'Tablet toog' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Koppel' }).click()
  await expect(kassa.getByText('Gekoppeld: Tablet toog')).toBeVisible()
  expect(backend.devices.get('cfd-7')!.linked_to).toBe('pos-e2e')
})

test('"Klantscherm openen": a window with the kassa\'s own display — the same one the next time', async ({ kassa, backend }) => {
  const opened: string[] = []
  for (let i = 0; i < 2; i++) {
    const [popup] = await Promise.all([kassa.waitForEvent('popup'), kassa.getByRole('button', { name: 'Klantscherm openen' }).click()])
    opened.push(new URL(popup.url()).searchParams.get('terminal')!)
    await popup.close()
  }
  expect(opened).toEqual(['display-of-pos-e2e', 'display-of-pos-e2e'])
  expect([...backend.devices.values()].filter((d) => d.role === 'cfd')).toHaveLength(1)
  expect(backend.devices.get('display-of-pos-e2e')).toMatchObject({ linked_to: 'pos-e2e', name: 'Kassa 1 · klantscherm' })
})
