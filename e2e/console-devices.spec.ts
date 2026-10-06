// Console → Toestellen: pairing a SumUp reader by the code it shows, and
// unpairing one. SumUp is answered by the fake backend (fake-catalog-admin.ts).
import { expect, test } from './console-fixtures'

test('without a SumUp account there is nothing to pair', async ({ console: open, page }) => {
  await open('/devices')
  await expect(page.getByRole('heading', { name: 'Toestellen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reader koppelen' })).toHaveCount(0)
})

test('pairs a reader by its code, which then shows in the list', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.sumupReaders = []
  await open('/devices')
  await page.getByRole('button', { name: 'Reader koppelen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Koppelen' })).toBeDisabled()
  await dialog.getByLabel('Koppelcode').fill('ab12cd34')
  await dialog.getByLabel('Naam').fill('Toog')
  await dialog.getByRole('button', { name: 'Koppelen' }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Toog is gekoppeld.')).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Toog' })
  await expect(row).toContainText('SumUp Virtual Solo')
  await expect(row).toContainText('Bezig')
  expect(catalogAdmin.sumupCalls).toEqual([
    { method: 'POST', path: '/api/bancontact/sumup/readers', body: { orgId: 'org-e2e', pairingCode: 'ab12cd34', name: 'Toog' } },
  ])
})

test("shows SumUp's reason when it refuses the code, and keeps the dialog open", async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.sumupReaders = []
  catalogAdmin.pairError = 'Pairing code not found'
  await open('/devices')
  await page.getByRole('button', { name: 'Reader koppelen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Koppelcode').fill('ZZ99ZZ99')
  await dialog.getByRole('button', { name: 'Koppelen' }).click()
  await expect(dialog.getByText('Pairing code not found')).toBeVisible()
  await expect(dialog.getByLabel('Koppelcode')).toHaveValue('ZZ99ZZ99')
})

test('unpairs a reader after confirming', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.sumupReaders = [{ id: 'rdr_9', name: 'Terras', status: 'paired', model: 'solo' }]
  await open('/devices')
  const row = page.getByRole('row').filter({ hasText: 'Terras' })
  await expect(row).toContainText('Gekoppeld')

  page.once('dialog', (d) => d.accept())
  await row.getByRole('button', { name: 'Acties voor Terras' }).click()
  await page.getByRole('menuitem', { name: 'Loskoppelen' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Terras' })).toHaveCount(0)
  expect(catalogAdmin.sumupCalls).toEqual([{ method: 'DELETE', path: '/api/bancontact/sumup/readers/rdr_9', body: null }])
})
