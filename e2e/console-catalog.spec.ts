import type { Page } from '@playwright/test'
import { expect, test } from './console-fixtures'
import { ORG_ID, type FakeCatalogAdmin } from './fake-catalog-admin'

const API = `/api/organizations/${ORG_ID}`

// Seeds the fake through its own API handler, so seeded data has exactly
// the shape the real backend would return.
function call(admin: FakeCatalogAdmin, method: string, path: string, body?: unknown): any {
  const res = admin.handle(method, `${API}${path}`, body ?? null)
  if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

// "Kaas & wijn": Drank (Pils €2,50, Cola €2,00) and Eten (Steak €18,00).
function seedCatalog(admin: FakeCatalogAdmin) {
  const drank = call(admin, 'POST', '/catalog/categories', { name: 'Drank' })
  const eten = call(admin, 'POST', '/catalog/categories', { name: 'Eten' })
  const pils = call(admin, 'POST', '/catalog/products', { name: 'Pils', categoryId: drank.id })
  const cola = call(admin, 'POST', '/catalog/products', { name: 'Cola', categoryId: drank.id })
  const steak = call(admin, 'POST', '/catalog/products', { name: 'Steak', categoryId: eten.id })
  const catalog = call(admin, 'POST', '/catalogs', { name: 'Kaas & wijn' })
  const sDrank = call(admin, 'POST', `/catalogs/${catalog.id}/sections`, { name: 'Drank' })
  const sEten = call(admin, 'POST', `/catalogs/${catalog.id}/sections`, { name: 'Eten' })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sDrank.id, variantId: pils.variants[0].id, priceCents: 250 })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sDrank.id, variantId: cola.variants[0].id, priceCents: 200 })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sEten.id, variantId: steak.variants[0].id, priceCents: 1800 })
  return { catalog, pils, cola, steak }
}

async function pick(page: Page, label: string | RegExp, option: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const defaultBadge = (page: Page, catalog: string) => page.getByTestId(`catalog-${catalog}`).locator('[data-slot=badge]')
const sectionNames = (page: Page) => page.locator('[data-testid^=section-] [data-slot=card-title]').allTextContents()
const entryNames = (page: Page, section: string) => page.getByTestId(`section-${section}`).locator('[data-testid^=entry-] p.font-medium').allTextContents()

test.describe('Producten', () => {
  test('manages categories, and shows the server refusal for a category in use', async ({ console: open, catalogAdmin }) => {
    const page = await open('/products')
    await page.getByLabel('Nieuwe categorie').fill('Drank')
    await page.getByRole('button', { name: 'Toevoegen', exact: true }).click()
    await expect(page.getByTestId('category-Drank')).toBeVisible()
    await page.getByLabel('Nieuwe categorie').fill('Etn')
    await page.getByRole('button', { name: 'Toevoegen', exact: true }).click()

    await page.getByTestId('category-Etn').getByRole('button', { name: 'Hernoemen' }).click()
    await page.getByLabel('Naam').fill('Eten')
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByTestId('category-Eten')).toBeVisible()

    call(catalogAdmin, 'POST', '/catalog/products', { name: 'Pils', categoryId: catalogAdmin.categories[0].id })
    await page.getByTestId('category-Drank').getByRole('button', { name: 'Verwijderen' }).click()
    await expect(page.getByText('Deze categorie wordt nog gebruikt door producten')).toBeVisible()

    await page.getByTestId('category-Eten').getByRole('button', { name: 'Verwijderen' }).click()
    await expect(page.getByTestId('category-Eten')).toHaveCount(0)
    expect(catalogAdmin.categories.map((c) => c.name)).toEqual(['Drank'])
  })

  test('creates a product with a category, BTW and two variants', async ({ console: open, catalogAdmin }) => {
    call(catalogAdmin, 'POST', '/catalog/categories', { name: 'Inschrijvingen' })
    const page = await open('/products')
    await page.getByRole('button', { name: 'Nieuw product' }).click()
    await page.getByLabel('Naam', { exact: true }).fill('Fietstocht')
    await pick(page, 'Categorie', 'Inschrijvingen')
    await pick(page, 'BTW', '6%')
    await page.getByLabel('Nieuwe variantnaam').fill('niet-lid')
    await page.getByLabel('Nieuwe variantcode').fill('fietstocht')
    await page.getByRole('button', { name: '+ Variant' }).click()
    await page.getByLabel('Nieuwe variantnaam').nth(1).fill('lid')
    await page.getByLabel('Nieuwe variantcode').nth(1).fill('fietstochtMember')
    await page.getByRole('button', { name: 'Aanmaken' }).click()

    const row = page.getByTestId('product-Fietstocht')
    await expect(row).toContainText('Inschrijvingen')
    await expect(row).toContainText('6%')
    await expect(row).toContainText('niet-lid· fietstocht')
    await expect(row).toContainText('lid· fietstochtMember')
    expect(catalogAdmin.products[0]).toMatchObject({ name: 'Fietstocht', vatRateBp: 600 })
    expect(catalogAdmin.variants.map((v) => [v.name, v.code])).toEqual([
      ['niet-lid', 'fietstocht'],
      ['lid', 'fietstochtMember'],
    ])
  })

  test('shows a duplicate code refusal and keeps the dialog open', async ({ console: open, catalogAdmin }) => {
    call(catalogAdmin, 'POST', '/catalog/products', { name: 'Pils', variants: [{ name: '', code: 'pils' }] })
    const page = await open('/products')
    await page.getByRole('button', { name: 'Nieuw product' }).click()
    await page.getByLabel('Naam', { exact: true }).fill('Pils 2')
    await page.getByLabel('Nieuwe variantcode').fill('pils')
    await page.getByRole('button', { name: 'Aanmaken' }).click()
    await expect(page.getByRole('dialog').getByText('Deze code wordt al gebruikt')).toBeVisible()
    expect(catalogAdmin.products).toHaveLength(1)
  })

  test('edits variants: add one, refuse archiving the last active one', async ({ console: open, catalogAdmin }) => {
    call(catalogAdmin, 'POST', '/catalog/products', { name: 'Steak', variants: [{ name: 'volwassene' }] })
    const page = await open('/products')
    await page.getByTestId('product-Steak').getByRole('button', { name: 'Bewerken' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByRole('button', { name: 'Archiveren' }).click()
    await expect(dialog.getByText('minstens één actieve variant')).toBeVisible()

    await dialog.getByRole('button', { name: '+ Variant' }).click()
    await dialog.getByLabel('Nieuwe variantnaam').fill('kind')
    await dialog.getByRole('button', { name: 'Toevoegen' }).click()
    await expect(dialog.getByLabel('Variantnaam')).toHaveCount(2)

    await dialog.getByRole('button', { name: 'Archiveren' }).first().click()
    await expect(dialog.getByRole('button', { name: 'Terugzetten' })).toBeVisible()
    expect(catalogAdmin.variants.map((v) => [v.name, v.archived])).toEqual([
      ['volwassene', true],
      ['kind', false],
    ])
  })

  test('archives a product and shows it again with "toon gearchiveerd"', async ({ console: open, catalogAdmin }) => {
    call(catalogAdmin, 'POST', '/catalog/products', { name: 'Oud bier' })
    const page = await open('/products')
    await page.getByTestId('product-Oud bier').getByRole('button', { name: 'Archiveren' }).click()
    await expect(page.getByTestId('product-Oud bier')).toHaveCount(0)
    await page.getByLabel('Toon gearchiveerd').click()
    await expect(page.getByTestId('product-Oud bier')).toContainText('gearchiveerd')
    await page.getByTestId('product-Oud bier').getByRole('button', { name: 'Terugzetten' }).click()
    await expect(page.getByTestId('product-Oud bier')).not.toContainText('gearchiveerd')
  })
})

test.describe('Menukaarten', () => {
  test('creates a catalog, a group and a priced line, then edits price, visibility and quick buttons', async ({ console: open, catalogAdmin }) => {
    call(catalogAdmin, 'POST', '/catalog/products', { name: 'Pils' })
    const page = await open('/catalogs')
    await page.getByRole('button', { name: 'Nieuwe menukaart' }).click()
    await page.getByLabel('Naam').fill('Standaard')
    await page.getByRole('button', { name: 'Aanmaken' }).click()

    // Straight into the editor; the first catalog is the default.
    await expect(page.getByRole('heading', { name: 'Standaard' })).toBeVisible()
    await expect(page.getByText('Standaard', { exact: true }).last()).toBeVisible()

    await page.getByRole('button', { name: 'Groep toevoegen' }).click()
    await page.getByLabel('Naam').fill('Drank')
    await page.getByRole('button', { name: 'Toevoegen' }).click()

    await pick(page, 'Product toevoegen aan Drank', 'Pils')
    await page.getByLabel('Prijs nieuw product Drank').fill('2,50')
    await page.getByTestId('section-Drank').getByRole('button', { name: 'Toevoegen' }).click()
    await expect(page.getByLabel('Prijs Pils')).toHaveValue('2,50')
    await expect(page.getByText('Alle producten staan al op deze menukaart')).toBeVisible()

    await page.getByLabel('Prijs Pils').fill('2.75')
    await page.getByLabel('Prijs Pils').press('Enter')
    await expect(page.getByLabel('Prijs Pils')).toHaveValue('2,75')
    expect(catalogAdmin.entries[0].priceCents).toBe(275)

    await page.getByLabel('Prijs Pils').fill('twee')
    await page.getByLabel('Prijs Pils').press('Enter')
    await expect(page.getByText('Ongeldige prijs voor Pils')).toBeVisible()
    expect(catalogAdmin.entries[0].priceCents).toBe(275)

    await page.getByLabel('Snelknoppen Pils').fill('6, 12, 24')
    await page.getByLabel('Snelknoppen Pils').press('Enter')
    await expect.poll(() => catalogAdmin.entries[0].quickQuantities).toEqual([6, 12, 24])

    await page.getByLabel('Zichtbaar Pils').click()
    await expect.poll(() => catalogAdmin.entries[0].visible).toBe(false)
  })

  test('reorders groups and lines with the arrows (full layout call)', async ({ console: open, catalogAdmin }) => {
    const { catalog } = seedCatalog(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await expect.poll(() => sectionNames(page)).toEqual(['Drank', 'Eten'])

    await page.getByRole('button', { name: 'Eten omhoog' }).click()
    await expect.poll(() => sectionNames(page)).toEqual(['Eten', 'Drank'])

    await page.getByRole('button', { name: 'Cola omhoog' }).click()
    await expect.poll(() => entryNames(page, 'Drank')).toEqual(['Cola', 'Pils'])
    await expect(page.getByRole('button', { name: 'Cola omhoog' })).toBeDisabled()
  })

  test('reloads and explains when the layout changed elsewhere (400)', async ({ console: open, catalogAdmin }) => {
    const { catalog } = seedCatalog(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await expect.poll(() => sectionNames(page)).toEqual(['Drank', 'Eten'])
    catalogAdmin.failNextLayout = true
    await page.getByRole('button', { name: 'Eten omhoog' }).click()
    await expect(page.getByText('De indeling is intussen gewijzigd — herlaad en probeer opnieuw')).toBeVisible()
    await expect.poll(() => sectionNames(page)).toEqual(['Drank', 'Eten'])
  })

  test('deletes a group after confirmation, and removes a line', async ({ console: open, catalogAdmin }) => {
    const { catalog } = seedCatalog(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await page.getByTestId('section-Eten').getByRole('button', { name: 'Verwijderen', exact: true }).first().click()
    await expect(page.getByRole('dialog')).toContainText('De 1 product(en) in deze groep verdwijnen')
    await page.getByRole('dialog').getByRole('button', { name: 'Verwijderen' }).click()
    await expect.poll(() => sectionNames(page)).toEqual(['Drank'])

    await page.getByTestId('entry-Cola').getByRole('button', { name: 'Verwijderen' }).click()
    await expect.poll(() => entryNames(page, 'Drank')).toEqual(['Pils'])
    expect(catalogAdmin.entries).toHaveLength(1)
  })

  test('marks a line whose product was archived as not on the kassa', async ({ console: open, catalogAdmin }) => {
    const { catalog, cola } = seedCatalog(catalogAdmin)
    call(catalogAdmin, 'PATCH', `/catalog/products/${cola.id}`, { archived: true })
    const page = await open(`/catalogs/${catalog.id}`)
    await expect(page.getByTestId('entry-Cola')).toContainText('Gearchiveerd product — niet op de kassa')
    await expect(page.getByTestId('entry-Pils')).not.toContainText('Gearchiveerd')
  })

  test('lists catalogs: default badge, set default, refuse archiving the default, duplicate', async ({ console: open, catalogAdmin }) => {
    seedCatalog(catalogAdmin)
    call(catalogAdmin, 'POST', '/catalogs', { name: 'Zomer' })
    const page = await open('/catalogs')

    const kaas = page.getByTestId('catalog-Kaas & wijn')
    await expect(defaultBadge(page, 'Kaas & wijn')).toHaveText('Standaard')
    await expect(kaas.getByRole('cell').nth(1)).toHaveText('3')

    await kaas.getByRole('button', { name: 'Archiveren' }).click()
    await expect(page.getByText('De standaardmenukaart kan niet gearchiveerd worden')).toBeVisible()

    await page.getByTestId('catalog-Zomer').getByRole('button', { name: 'Standaard maken' }).click()
    await expect(defaultBadge(page, 'Zomer')).toHaveText('Standaard')
    await expect(defaultBadge(page, 'Kaas & wijn')).toHaveCount(0)

    await page.getByTestId('catalog-Kaas & wijn').getByRole('button', { name: 'Dupliceren' }).click()
    await expect(page.getByLabel('Naam van de kopie')).toHaveValue('Kaas & wijn (kopie)')
    await page.getByLabel('Naam van de kopie').fill('Kaas & wijn 2027')
    await page.getByRole('dialog').getByRole('button', { name: 'Dupliceren' }).click()
    await expect(page.getByTestId('catalog-Kaas & wijn 2027').getByRole('cell').nth(1)).toHaveText('3')

    await page.getByTestId('catalog-Kaas & wijn').getByRole('button', { name: 'Archiveren' }).click()
    await expect(page.getByTestId('catalog-Kaas & wijn')).toHaveCount(0)
  })

  test('the editor fits a phone screen without sideways scrolling', async ({ console: open, catalogAdmin, page }) => {
    const { catalog } = seedCatalog(catalogAdmin)
    await page.setViewportSize({ width: 390, height: 844 })
    await open(`/catalogs/${catalog.id}`)
    await expect(page.getByTestId('section-Drank')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
