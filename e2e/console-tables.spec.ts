// Console → Tafels and Bediening (release C): tables with their QR codes,
// inviting someone as Bediening, and that role seeing only the waiter screen.
import { expect, test } from './console-fixtures'

test('tables in zones, each with its QR code; all of them on one page to print', async ({ console: open, page, catalogAdmin }) => {
  await open('/tables')
  await expect(page.getByRole('heading', { name: 'Tafels' })).toBeVisible()
  for (const [name, zone] of [['1', 'Zaal'], ['T1', 'Terras']]) {
    await page.getByRole('button', { name: 'Tafel toevoegen' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Naam of nummer').fill(name)
    await dialog.getByLabel('Zone (optioneel)').fill(zone)
    await dialog.getByRole('button', { name: 'Opslaan' }).click()
    await expect(dialog).toBeHidden()
  }
  expect(catalogAdmin.tables.map((t) => [t.name, t.zone])).toEqual([['1', 'Zaal'], ['T1', 'Terras']])
  await expect(page.getByTestId('table-row')).toHaveCount(2)

  await page.getByTestId('table-row').filter({ hasText: 'Tafel T1' }).getByRole('button', { name: 'Tafel T1' }).click()
  await page.getByRole('menuitem', { name: 'QR-code tonen' }).click()
  await expect(page.getByTestId('table-qr')).toContainText('/tafel/qr1abcdefghijklmnop')
  await expect(page.getByTestId('table-qr').locator('svg')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'QR-codes afdrukken' }).click()
  await expect(page.getByTestId('qr-sheet').locator('svg')).toHaveCount(2)
})

test('inviting someone as Bediening', async ({ console: open, page, catalogAdmin }) => {
  await open('/users')
  await page.getByRole('button', { name: /Uitnodigen|Lid uitnodigen/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill('ober@club.test')
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: /Bediening/ }).click()
  await dialog.getByRole('button', { name: 'Uitnodigen' }).click()
  await expect.poll(() => catalogAdmin.members[0]?.role).toBe('waiter')
})

test('the role Bediening: the console points to the waiter screen', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.myRole = 'waiter'
  await open('/dashboard')
  await expect(page.getByTestId('waiter-only')).toContainText('bedieningsscherm')
  await expect(page.getByTestId('waiter-only').getByRole('link', { name: 'Open de bediening' })).toHaveAttribute('href', '/bediening')
})
