import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import writeXlsxFile from 'write-excel-file/node'
import { readSheet } from 'read-excel-file/node'
import { parseCsv } from '../src/apps/admin/lib/menu-sheet'
import { expect, test } from './console-fixtures'
import { ORG_ID, type FakeCatalogAdmin } from './fake-catalog-admin'

const API = `/api/organizations/${ORG_ID}`

function call(admin: FakeCatalogAdmin, method: string, path: string, body?: unknown): any {
  const res = admin.handle(method, `${API}${path}`, body ?? null)
  if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

// "Kaas & wijn": Drank (Pils €2,50) and Eten (Steak volwassene €18, kind €12).
function seed(admin: FakeCatalogAdmin) {
  const drank = call(admin, 'POST', '/catalog/categories', { name: 'Drank' })
  const eten = call(admin, 'POST', '/catalog/categories', { name: 'Eten' })
  const pils = call(admin, 'POST', '/catalog/products', { name: 'Pils', categoryId: drank.id, vatRateBp: 2100 })
  const steak = call(admin, 'POST', '/catalog/products', { name: 'Steak', categoryId: eten.id, variants: [{ name: 'volwassene' }, { name: 'kind' }] })
  const catalog = call(admin, 'POST', '/catalogs', { name: 'Kaas & wijn' })
  const sDrank = call(admin, 'POST', `/catalogs/${catalog.id}/sections`, { name: 'Drank' })
  const sEten = call(admin, 'POST', `/catalogs/${catalog.id}/sections`, { name: 'Eten' })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sDrank.id, variantId: pils.variants[0].id, priceCents: 250, quickQuantities: [6, 12] })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sEten.id, variantId: steak.variants[0].id, priceCents: 1800 })
  call(admin, 'POST', `/catalogs/${catalog.id}/entries`, { sectionId: sEten.id, variantId: steak.variants[1].id, priceCents: 1200 })
  return catalog
}

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  return writeXlsxFile(rows as any, { sheet: 'Menukaart' }).toBuffer()
}

async function pickFile(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await page.getByLabel('Bestand (.xlsx of .csv)').setInputFiles({ name, mimeType, buffer })
}

const entryNames = (page: Page, section: string) => page.getByTestId(`section-${section}`).locator('[data-testid^=entry-] p.font-medium').allTextContents()

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test.describe('Menukaart export', () => {
  test('exports .xlsx with the menukaart rows and an Uitleg sheet', async ({ console: open, catalogAdmin }) => {
    const catalog = seed(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await page.getByRole('button', { name: 'Exporteren' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Excel (.xlsx)' }).click()])
    expect(download.suggestedFilename()).toBe('menukaart-Kaas & wijn.xlsx')

    const buffer = readFileSync(await download.path())
    expect(await readSheet(buffer)).toEqual([
      ['Groep', 'Product', 'Variant', 'Prijs', 'Categorie', 'BTW', 'Code', 'Snelknoppen', 'Zichtbaar'],
      ['Drank', 'Pils', null, 2.5, 'Drank', 21, null, '6, 12', 'ja'],
      ['Eten', 'Steak', 'volwassene', 18, 'Eten', null, null, null, 'ja'],
      ['Eten', 'Steak', 'kind', 12, 'Eten', null, null, null, 'ja'],
    ])
    const uitleg = await readSheet(buffer, 'Uitleg')
    expect(uitleg[0][1]).toContain('Kaas & wijn')
    expect(uitleg.some((row) => String(row[1]).includes('Leeg bij een bestaand product = ongewijzigd'))).toBe(true)
  })

  test('exports ;-separated CSV with decimal comma from the menukaarten list', async ({ console: open, catalogAdmin }) => {
    seed(catalogAdmin)
    const page = await open('/catalogs')
    await page.getByTestId('catalog-Kaas & wijn').getByRole('button', { name: 'Exporteren' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'CSV (.csv)' }).click()])
    expect(download.suggestedFilename()).toBe('menukaart-Kaas & wijn.csv')
    const text = readFileSync(await download.path(), 'utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(parseCsv(text)[1]).toEqual(['Drank', 'Pils', '', '2,50', 'Drank', '21', '', '6, 12', 'ja'])
  })

  test('downloads a template with the headers', async ({ console: open }) => {
    const page = await open('/catalogs')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sjabloon downloaden' }).click()])
    expect(download.suggestedFilename()).toBe('menukaart-sjabloon.xlsx')
    const rows = await readSheet(readFileSync(await download.path()))
    expect(rows[0]).toEqual(['Groep', 'Product', 'Variant', 'Prijs', 'Categorie', 'BTW', 'Code', 'Snelknoppen', 'Zichtbaar'])
    expect(rows.length).toBeGreaterThan(1)
  })
})

test.describe('Menukaart import', () => {
  test('replaces a menukaart: preview shows the changes, apply reloads the editor', async ({ console: open, catalogAdmin }) => {
    const catalog = seed(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await page.getByRole('button', { name: 'Importeren' }).click()
    await expect(page.getByRole('dialog')).toContainText('Producten worden nooit verwijderd')

    // Pils gets more expensive, Cola is new, Steak (kind) is dropped; the
    // empty Groep/Product cells rely on "empty = row above".
    await pickFile(
      page,
      'nieuw.xlsx',
      await xlsx([
        ['Groep', 'Product', 'Variant', 'Prijs', 'Opmerking'],
        ['Drank', 'Pils', null, 2.75, 'duurder'],
        [null, 'Cola', null, '2,00', null],
        ['Eten', 'Steak', 'volwassene', 18, null],
      ]),
      XLSX_MIME
    )
    await page.getByRole('button', { name: 'Voorbeeld bekijken' }).click()

    const preview = page.getByTestId('import-preview')
    await expect(preview).toContainText('Pils: € 2,50 → € 2,75')
    await expect(preview).toContainText('Nieuwe producten (1)')
    await expect(preview).toContainText('Verwijderd van deze menukaart (1)')
    await expect(preview).toContainText('Steak (kind)')
    await expect(page.getByText('Genegeerde kolommen: Opmerking')).toBeVisible()
    // Raw cells with their real sheet row numbers; the fill-down is the backend's job.
    expect(catalogAdmin.importRequests[0]).toMatchObject({
      catalogId: catalog.id,
      dryRun: true,
      rows: [
        { row: 2, groep: 'Drank', product: 'Pils', prijs: 2.75 },
        { row: 3, groep: null, product: 'Cola', prijs: '2,00' },
        { row: 4, groep: 'Eten', product: 'Steak', variant: 'volwassene', prijs: 18 },
      ],
    })
    // Nothing written by the preview.
    expect(catalogAdmin.entries.filter((e) => e.catalogId === catalog.id).map((e) => e.priceCents)).toEqual([250, 1800, 1200])

    await page.getByRole('button', { name: 'Toepassen' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('section-Drank')).toContainText('Cola')
    // Steak (kind) is off this menukaart now (only offered in the "add" picker).
    await expect(entryNames(page, 'Eten')).resolves.toEqual(['Steak (volwassene)'])
    expect(catalogAdmin.importRequests[1].dryRun).toBe(false)
  })

  test('shows errors with row numbers and keeps Toepassen disabled', async ({ console: open, catalogAdmin }) => {
    const catalog = seed(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await page.getByRole('button', { name: 'Importeren' }).click()
    await pickFile(page, 'fout.csv', Buffer.from('Groep;Product;Prijs;Zichtbaar\nDrank;Pils;;ja\n\nDrank;Cola;2,00;misschien\n'), 'text/csv')
    await page.getByRole('button', { name: 'Voorbeeld bekijken' }).click()

    const errors = page.getByTestId('import-errors')
    await expect(errors).toContainText('Rij 2: Prijs ontbreekt of is ongeldig')
    await expect(errors).toContainText('Rij 4: Zichtbaar "misschien" moet ja of nee zijn')
    await expect(page.getByRole('button', { name: 'Toepassen' })).toBeDisabled()
    expect(catalogAdmin.importRequests).toHaveLength(1)
  })

  test('refuses a file without the required headers, without calling the backend', async ({ console: open, catalogAdmin }) => {
    const catalog = seed(catalogAdmin)
    const page = await open(`/catalogs/${catalog.id}`)
    await page.getByRole('button', { name: 'Importeren' }).click()
    await pickFile(page, 'oud.xlsx', await xlsx([['Naam', 'Bedrag'], ['Pils', 2.5]]), XLSX_MIME)
    await page.getByRole('button', { name: 'Voorbeeld bekijken' }).click()
    await expect(page.getByTestId('import-errors')).toContainText('Verplichte kolommen ontbreekt: Groep, Product, Prijs')
    expect(catalogAdmin.importRequests).toHaveLength(0)
  })

  test('imports a file as a new menukaart, named after the file', async ({ console: open, catalogAdmin }) => {
    seed(catalogAdmin)
    const page = await open('/catalogs')
    await page.getByRole('button', { name: 'Importeren' }).click()
    await pickFile(page, 'menukaart-Zomerbar.csv', Buffer.from('﻿Groep;Product;Prijs\nBar;Mojito;7,50\n;Pils;2,50\n'), 'text/csv')
    await expect(page.getByLabel('Naam van de nieuwe menukaart')).toHaveValue('Zomerbar')
    await page.getByRole('button', { name: 'Voorbeeld bekijken' }).click()
    await expect(page.getByTestId('import-preview')).toContainText('Nieuwe producten (1)')
    await expect(page.getByTestId('import-preview')).toContainText('Mojito')
    await page.getByRole('button', { name: 'Toepassen' }).click()

    await expect(page.getByRole('heading', { name: 'Zomerbar' })).toBeVisible()
    await expect(page.getByTestId('section-Bar')).toContainText('Mojito')
    await expect(page.getByTestId('section-Bar')).toContainText('Pils')
    expect(catalogAdmin.importRequests[1]).toMatchObject({ name: 'Zomerbar', dryRun: false })
    // Pils was matched to the existing product, not duplicated.
    expect(catalogAdmin.products.filter((p) => p.name === 'Pils')).toHaveLength(1)
  })
})
