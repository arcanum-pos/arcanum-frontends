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

test('the pairing dialog links to the SumUp guide on the website', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.sumupReaders = []
  await open('/devices')
  await page.getByRole('button', { name: 'Reader koppelen' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Meer uitleg' })).toHaveAttribute('href', 'https://arcanum.kaboutersoft.be/docs/sumup')
})

test('Toestel toevoegen: a pairing code with its QR, until a device claims it', async ({ console: open, page, catalogAdmin }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Koppelcode maken' })).toBeDisabled()
  await dialog.getByLabel('Naam').fill('Kassa toog')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()

  const code = dialog.getByTestId('pairing-code')
  await expect(code).toContainText('K7PM-4XQ1')
  await expect(code).toContainText(/Nog (9:5\d|10:00) geldig/)
  await expect(code.locator('svg')).toBeVisible() // the QR
  await expect(dialog).toContainText('kies "Dit toestel koppelen" en geef deze code in')
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'pos', name: 'Kassa toog' })

  // A device claims it: the dialog notices, and the list shows the new kassa by name.
  catalogAdmin.claimPairing('K7PM-4XQ1')
  await expect(dialog.getByTestId('pairing-claimed')).toHaveText('Kassa toog is gekoppeld.', { timeout: 10_000 })
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Kassa toog' })).toContainText('Kassa')
})

test('a customer display, and an open code revoked from the list', async ({ console: open, page, catalogAdmin }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Klantscherm' }).click()
  await dialog.getByLabel('Naam').fill('Scherm toog')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0].role).toBe('cfd')
  await page.keyboard.press('Escape')

  await page.reload()
  const open_ = page.getByTestId('open-pairings')
  await expect(open_).toContainText('Klantscherm · Scherm toog · nog 10 min geldig')
  await open_.getByRole('button', { name: 'Intrekken' }).click()
  await expect(page.getByTestId('open-pairings')).toHaveCount(0)
  expect(catalogAdmin.pairings[0].status).toBe('revoked')
})

test('a device is listed by its name and removed after confirming', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.orgDevices = [{ terminal_id: 'pos-1', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: true, name: 'Kassa toog' }]
  await open('/devices')
  const row = page.getByRole('row').filter({ hasText: 'Kassa toog' })
  await expect(row).toContainText('pos-1')
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Kassa toog verwijderen?')
    d.accept()
  })
  await row.getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Verwijderen' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Kassa toog' })).toHaveCount(0)
})

test('a customer display for a given kassa: chosen by name, linked as soon as it is paired', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.orgDevices = [
    { terminal_id: 'pos-1', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: true, name: 'Kassa toog' },
    { terminal_id: 'pos-2', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: true, name: 'Kassa terras' },
  ]
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox', { name: 'Voor welke kassa?' })).toHaveCount(0) // only for a display
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Klantscherm' }).click()
  await dialog.getByRole('combobox', { name: 'Voor welke kassa?' }).click()
  await expect(page.getByRole('option')).toHaveText(['Later koppelen (in de Instellingen van de kassa)', 'Kassa toog', 'Kassa terras'])
  await page.getByRole('option', { name: 'Kassa terras' }).click()
  await dialog.getByLabel('Naam').fill('Tablet terras')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'cfd', name: 'Tablet terras', linkTo: 'pos-2' })

  catalogAdmin.claimPairing(catalogAdmin.pairings[0].code)
  await expect(dialog.getByTestId('pairing-claimed')).toHaveText('Tablet terras is gekoppeld en toont de betalingen van Kassa terras.', { timeout: 10_000 })
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Tablet terras' })).toContainText('Kassa terras')
})
