// Console: an event's menu, self-ordering (its link and QR code) and order
// numbers; a station screen as a device — DOMAIN_MODEL.md "Self-ordering and
// station screens". Answered by fake-catalog-admin.ts.
import { expect, test } from './console-fixtures'

function call(admin: any, method: string, path: string, body?: unknown) {
  return admin.handle(method, `/api/organizations/org-e2e${path}`, body)
}

test('an event: pick a menu, switch self-ordering on, and get its link and QR code', async ({ console: open, page, catalogAdmin }) => {
  call(catalogAdmin, 'POST', '/catalogs', { name: 'Fuifkaart' })
  catalogAdmin.events = [{ id: 'ev1', name: 'Fuif', date: '2026-10-11', createdAt: '2026-10-01T10:00:00Z', catalogId: null, selfOrder: { enabled: false, code: null }, lastOrderNumber: 41 }]
  await open('/events')
  const row = page.getByRole('row').filter({ hasText: 'Fuif' })
  await expect(row).toContainText('Uit')
  await row.getByRole('button', { name: 'Instellen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Fuif — instellen' })).toBeVisible()
  // No menu yet: self-ordering can't be switched on.
  await expect(dialog.getByRole('switch', { name: 'Zelfbestellen' })).toBeDisabled()

  await dialog.getByRole('combobox', { name: 'Menukaart' }).click()
  await page.getByRole('option', { name: 'Fuifkaart' }).click()
  await dialog.getByRole('switch', { name: 'Zelfbestellen' }).click()
  const link = dialog.getByTestId('self-order-link')
  await expect(link.getByLabel('Link voor gasten')).toHaveValue(/\/bestel\/code-/)
  await expect(link.locator('svg title')).toHaveText('QR-code om te bestellen')
  expect(catalogAdmin.eventCalls.map((c: any) => c.body)).toEqual([{ catalogId: expect.any(String) }, { selfOrderEnabled: true }])

  // How guests pay: the counter by default, Bancontact as well.
  const pay = dialog.getByTestId('pay-methods')
  await expect(pay.getByRole('switch', { name: 'Aan de toog, met hun nummer' })).toBeChecked()
  await pay.getByRole('switch', { name: 'Met Bancontact, op hun telefoon' }).click()
  await expect(pay.getByRole('switch', { name: 'Met Bancontact, op hun telefoon' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ payBancontact: true })
  // Ordering on a tab, paid when leaving.
  await pay.getByRole('switch', { name: 'Bijbestellen op hun rekening, betalen bij vertrek' }).click()
  await expect(pay.getByRole('switch', { name: 'Bijbestellen op hun rekening, betalen bij vertrek' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ tabs: true })

  // A new link replaces the old one, after confirming.
  const before = await link.getByLabel('Link voor gasten').inputValue()
  page.once('dialog', (d) => d.accept())
  await link.getByRole('button', { name: 'Nieuwe link maken' }).click()
  await expect(link.getByLabel('Link voor gasten')).not.toHaveValue(before)

  // Numbers start again at 1, after confirming.
  await expect(dialog.getByTestId('last-number')).toHaveText('Laatste nummer: #41.')
  page.once('dialog', (d) => d.accept())
  await dialog.getByRole('button', { name: 'Opnieuw vanaf 1' }).click()
  await expect(dialog.getByTestId('last-number')).toHaveText('De volgende bestelling krijgt #1.')

  await page.keyboard.press('Escape')
  await expect(row).toContainText('Aan')
  await expect(row).toContainText('Fuifkaart')
})

test('Toestel toevoegen: a station screen for one station', async ({ console: open, page, catalogAdmin }) => {
  call(catalogAdmin, 'POST', '/catalog/stations', { name: 'Keuken' })
  call(catalogAdmin, 'POST', '/catalog/stations', { name: 'Bar' })
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Stationscherm' }).click()
  await expect(dialog.getByText('Het scherm toont de bonnen van dit station.')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Station' }).click()
  await page.getByRole('option', { name: 'Bar' }).click()
  await dialog.getByLabel('Naam').fill('Scherm bar')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'station', name: 'Scherm bar', stationId: catalogAdmin.stations.find((s: any) => s.name === 'Bar')!.id })
})

test('a station screen without stations to choose: says where to make one', async ({ console: open, page }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Stationscherm' }).click()
  await expect(dialog.getByText('Maak eerst een station')).toBeVisible()
  await dialog.getByLabel('Naam').fill('Scherm')
  await expect(dialog.getByRole('button', { name: 'Koppelcode maken' })).toBeDisabled()
})
