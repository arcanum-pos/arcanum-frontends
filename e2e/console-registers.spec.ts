// Console → Kassalades (release B2): the cash drawers kassas pick, blind
// count, and the latest shifts with their difference.
import { expect, test } from './console-fixtures'

test('add, rename and archive a drawer; an open one stays; blind count; the latest shifts', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.registers.push({ id: 'bar', name: 'Bar', archived: false, open: true })
  catalogAdmin.shifts.push(
    { id: 's2', number: 2, registerId: 'bar', registerName: 'Bar', status: 'open', openedAt: '2026-10-15T18:00:00Z', openedBy: 'An', closedAt: null, closedBy: null, openingFloatCents: 5000, expectedCents: null, countedCents: null, differenceCents: null, note: null, people: [{ name: 'Bert', payments: 4 }, { name: 'Barbara', payments: 2 }] },
    { id: 's1', number: 1, registerId: 'bar', registerName: 'Bar', status: 'closed', openedAt: '2026-10-14T18:00:00Z', openedBy: 'Jan', closedAt: '2026-10-15T01:00:00Z', closedBy: 'Jan', openingFloatCents: 5000, expectedCents: 32050, countedCents: 31850, differenceCents: -200, note: 'Fout teruggegeven' }
  )
  await open('/registers')
  await expect(page.getByRole('heading', { name: 'Kassalades' })).toBeVisible()
  await page.getByRole('button', { name: 'Kassalade toevoegen' }).click()
  await page.getByRole('dialog').getByLabel('Naam').fill('Toog')
  await page.getByRole('dialog').getByRole('button', { name: 'Opslaan' }).click()
  await expect(page.getByTestId('register-row')).toHaveCount(2)
  await expect(page.getByTestId('register-row').filter({ hasText: 'Bar' })).toContainText('Open')

  // An open drawer is not archived: the reason.
  await page.getByTestId('register-row').filter({ hasText: 'Bar' }).getByRole('button', { name: 'Bar' }).click()
  await page.getByRole('menuitem', { name: 'Archiveren' }).click()
  await expect(page.getByRole('alert')).toContainText('doe eerst de kasopmaak')

  await page.getByRole('switch', { name: 'Blind tellen' }).click()
  await expect.poll(() => catalogAdmin.blindCount).toBe(true)

  const rows = page.getByTestId('shift-row')
  await expect(rows.first()).toContainText('nog open')
  // Who worked on it.
  await expect(rows.first().getByTestId('shift-people')).toHaveText('Bert (4) · Barbara (2)')
  await expect(rows.nth(1)).toContainText('-€ 2,00')
  await expect(rows.nth(1)).toContainText('€ 318,50')
})
