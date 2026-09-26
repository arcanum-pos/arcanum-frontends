import { expect, panel, test } from './fixtures'

// Search and group filter above the products (design_files: "Zoek product of
// typ een code…" + Alles / one chip per group). Matching rules themselves
// are unit-tested (lib.test.ts); this is the kassa behaviour.

const rows = (kassa: import('@playwright/test').Page) => kassa.locator('section button[title="Klik: +1 · rechtsklik: −1"]')

test('search narrows the products; no match says so; Escape clears', async ({ kassa }) => {
  const search = kassa.getByRole('searchbox', { name: 'Zoek product' })
  await expect(search).toHaveAttribute('placeholder', 'Zoek product of typ een code…')

  await search.fill('wandel')
  await expect(rows(kassa)).toHaveCount(2)
  await expect(kassa.getByRole('button', { name: /^Wandeltocht \(lid\)/ })).toBeVisible()
  await expect(kassa.getByRole('heading', { name: 'Bonnen' })).toHaveCount(0) // empty groups disappear

  await search.fill('WANDEL niet')
  await expect(rows(kassa)).toHaveCount(1)

  await search.fill('pizza')
  await expect(kassa.getByText('Geen producten gevonden voor “pizza”.')).toBeVisible()

  await search.press('Escape')
  await expect(search).toHaveValue('')
  await expect(rows(kassa)).toHaveCount(4)
  await expect(kassa.getByRole('heading', { name: 'Bonnen' })).toBeVisible()
})

test('group chips show one group; the active chip or "Alles" shows all again', async ({ kassa }) => {
  const chips = kassa.getByRole('group', { name: 'Groep' })
  await expect(chips.getByRole('button')).toHaveText(['Alles', 'Bonnen', 'Tochten'])
  await expect(chips.getByRole('button', { name: 'Alles' })).toHaveAttribute('aria-pressed', 'true')

  await chips.getByRole('button', { name: 'Tochten' }).click()
  await expect(chips.getByRole('button', { name: 'Tochten' })).toHaveAttribute('aria-pressed', 'true')
  await expect(kassa.getByRole('heading', { name: 'Bonnen' })).toHaveCount(0)
  await expect(kassa.getByRole('heading', { name: 'Tochten' })).toBeVisible()

  // Search within the group.
  await kassa.getByRole('searchbox', { name: 'Zoek product' }).fill('bon')
  await expect(kassa.getByText('Geen producten gevonden voor “bon”.')).toBeVisible()
  await kassa.getByRole('searchbox', { name: 'Zoek product' }).fill('')

  await chips.getByRole('button', { name: 'Tochten' }).click() // again: back to all
  await expect(kassa.getByRole('heading', { name: 'Bonnen' })).toBeVisible()
  await chips.getByRole('button', { name: 'Bonnen' }).click()
  await chips.getByRole('button', { name: 'Alles' }).click()
  await expect(kassa.getByRole('heading', { name: 'Tochten' })).toBeVisible()
})

test('Enter adds an exact code or the only match, then clears for the next one', async ({ kassa }) => {
  const search = kassa.getByRole('searchbox', { name: 'Zoek product' })
  await search.fill('fietstochtMember') // a product code
  await search.press('Enter')
  await expect(search).toHaveValue('')
  await expect(panel(kassa).getByText('Fietstocht (lid)')).toBeVisible()

  await search.fill('wandel niet')
  await search.press('Enter')
  await expect(panel(kassa).getByText('Wandeltocht (niet-lid)')).toBeVisible()

  // Ambiguous ("lid" is in "niet-lid" too): nothing is added, the search stays.
  await search.fill('wandel lid')
  await search.press('Enter')
  await expect(search).toHaveValue('wandel lid')
  await search.fill('fiets')
  await search.press('Enter')
  await expect(search).toHaveValue('fiets')
  await expect(panel(kassa)).toContainText('2 items')
})

test('filtering never touches the order', async ({ kassa }) => {
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await kassa.getByRole('searchbox', { name: 'Zoek product' }).fill('bon')
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(panel(kassa)).toContainText('6 items')
  await expect(panel(kassa).getByText('Fietstocht (niet-lid)')).toBeVisible()
})
