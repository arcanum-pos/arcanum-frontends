// Console: an event runs over one day or several (its first and last day,
// both included) — made with them, changed later in its settings.
import { expect, test } from './console-fixtures'

test('a new event over two days, then a third day and another name in its settings', async ({ console: open, page, catalogAdmin }) => {
  await open('/events')
  await page.getByRole('button', { name: 'Nieuw evenement' }).click()
  const create = page.getByRole('dialog')
  await create.getByLabel('Naam').fill('Kamp')
  await create.getByLabel('Eerste dag').fill('2026-09-12')
  await create.getByLabel('Laatste dag').fill('2026-09-13')
  await create.getByRole('button', { name: 'Aanmaken' }).click()
  await expect(create).toBeHidden()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toMatchObject({ name: 'Kamp', date: '2026-09-12', endDate: '2026-09-13' })
  const row = page.getByRole('row').filter({ hasText: 'Kamp' })
  await expect(row).toContainText('12/09/2026 – 13/09/2026')

  await row.getByRole('button', { name: 'Instellen' }).click()
  const days = page.getByRole('dialog').getByTestId('event-days')
  await expect(days.getByLabel('Laatste dag')).toHaveValue('2026-09-13')
  await days.getByRole('textbox', { name: 'Naam en dagen' }).fill('Zomerkamp')
  await days.getByLabel('Laatste dag').fill('2026-09-14')
  await days.getByRole('button', { name: 'Opslaan' }).click()
  await expect.poll(() => catalogAdmin.eventCalls.at(-1)!.body).toMatchObject({ name: 'Zomerkamp', date: '2026-09-12', endDate: '2026-09-14' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('row').filter({ hasText: 'Zomerkamp' })).toContainText('12/09/2026 – 14/09/2026')
})

test('a one-day event shows one date, and its last day stays empty', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.events = [{ id: 'ev1', name: 'Quiz', date: '2026-10-11', endDate: '2026-10-11', createdAt: '2026-10-01T10:00:00Z', selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 0 }]
  await open('/events')
  const row = page.getByRole('row').filter({ hasText: 'Quiz' })
  await expect(row.getByRole('cell').nth(1)).toHaveText('11/10/2026')
  await row.getByRole('button', { name: 'Instellen' }).click()
  const days = page.getByRole('dialog').getByTestId('event-days')
  await expect(days.getByLabel('Laatste dag')).toHaveValue('')
  await expect(days.getByRole('button', { name: 'Opslaan' })).toBeDisabled()
})
