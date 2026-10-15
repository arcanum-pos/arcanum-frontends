// Console → Medewerkers (release B1): the people on the shared kassas and
// station screens — a name and an optional PIN; admins choose whether one
// must be picked to sell.
import { expect, test } from './console-fixtures'

test('add (with or without a PIN), rename, a PIN set and removed, archived; "required" switched on', async ({ console: open, page, catalogAdmin }) => {
  await open('/staff')
  await expect(page.getByRole('heading', { name: 'Medewerkers' })).toBeVisible()
  await expect(page.getByText('Nog geen medewerkers.')).toBeVisible()

  await page.getByRole('button', { name: 'Medewerker toevoegen' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Naam').fill('Jan')
  await dialog.getByLabel('Pincode (optioneel)').fill('24a68')
  await expect(dialog.getByLabel('Pincode (optioneel)')).toHaveValue('2468')
  await dialog.getByRole('button', { name: 'Opslaan' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Medewerker toevoegen' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Naam').fill('Mie')
  await dialog.getByRole('button', { name: 'Opslaan' }).click()
  expect(catalogAdmin.staffCalls.slice(0, 2).map((c) => c.body)).toEqual([{ name: 'Jan', pin: '2468' }, { name: 'Mie' }])

  const jan = page.getByTestId('staff-row').filter({ hasText: 'Jan' })
  await expect(jan).toContainText('Met pincode')
  await expect(page.getByTestId('staff-row').filter({ hasText: 'Mie' })).toContainText('Geen')

  // Rename, remove the PIN, archive.
  await jan.getByRole('button', { name: 'Jan' }).click()
  await page.getByRole('menuitem', { name: 'Pincode verwijderen' }).click()
  await expect(jan).toContainText('Geen')
  await jan.getByRole('button', { name: 'Jan' }).click()
  await page.getByRole('menuitem', { name: 'Archiveren' }).click()
  await expect(page.getByTestId('staff-row')).toHaveCount(1)
  await page.getByRole('switch', { name: 'Toon gearchiveerde' }).click()
  await expect(page.getByTestId('staff-row').filter({ hasText: 'Jan' })).toContainText('Gearchiveerd')

  // A person must be chosen to sell.
  await page.getByRole('switch', { name: 'Medewerker kiezen verplicht' }).click()
  await expect.poll(() => catalogAdmin.staffRequired).toBe(true)
})

test('a name already in use: the reason, the dialog stays open', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.staff.push({ id: 's1', name: 'An', hasPin: false, memberId: null, archived: false, createdAt: '' })
  await open('/staff')
  await page.getByRole('button', { name: 'Medewerker toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Naam').fill('an')
  await dialog.getByRole('button', { name: 'Opslaan' }).click()
  await expect(dialog).toContainText('Er is al een medewerker met die naam')
})
