import { readFileSync } from 'node:fs'
import { expect, test } from './console-fixtures'
import { exportFile } from './fake-org-transfer'

// Org data export / import (Instellingen → Gegevens, the team switcher's
// "Nieuwe organisatie", and the unfinished-import banner). The fake
// enforces the backend's import rules; the backend's own suite covers the
// data itself.

const asUpload = (data: unknown, name = 'arcanum-export-scouts.json') => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(data)),
})

const chunkCalls = (calls: { path: string; body: any; status: number }[]) => calls.filter((c) => c.path.endsWith('/import/chunk'))

test('exports all data, with secrets only when asked (and warned)', async ({ console: open, orgTransfer }) => {
  const page = await open('/settings/data')
  await expect(page.getByRole('heading', { name: 'Gegevens' })).toBeVisible()

  const [plain] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Alle gegevens exporteren' }).click()])
  expect(plain.suggestedFilename()).toBe('arcanum-export-e2e-2026-09-25.json')
  expect(JSON.parse(readFileSync(await plain.path(), 'utf8')).includesSecrets).toBe(false)
  expect(orgTransfer.exportQueries).toEqual([''])

  await page.getByLabel('Inclusief geheimen (betaal- en mailinstellingen, onversleuteld)').check()
  await expect(page.getByRole('alert')).toContainText('wachtwoorden en API-sleutels')
  const [withSecrets] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Alle gegevens exporteren' }).click()])
  expect(JSON.parse(readFileSync(await withSecrets.path(), 'utf8')).includesSecrets).toBe(true)
  expect(orgTransfer.exportQueries).toEqual(['', 'secrets=1'])
})

test('imports an export as a new org: summary, progress, report, switch', async ({ console: open, orgTransfer }) => {
  const page = await open('/settings/data')
  await page.getByRole('button', { name: 'Organisatie importeren uit exportbestand' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload(exportFile()))

  await expect(dialog.getByLabel('Naam van de organisatie')).toHaveValue('Scouts Elewijt')
  await expect(dialog.getByRole('row', { name: /Producten/ })).toContainText('3')
  await expect(dialog).toContainText('geen betaal- of mailinstellingen')
  await dialog.getByLabel('Naam van de organisatie').fill('Scouts kopie')
  await dialog.getByRole('button', { name: 'Importeren' }).click()

  await expect(dialog).toContainText('Import voltooid.')
  await expect(dialog.getByRole('row', { name: /Producten/ })).toContainText('3 / 3')

  const start = orgTransfer.calls.find((c) => c.path.endsWith('/import/start'))!
  expect(start.body).toMatchObject({ name: 'Scouts kopie', manifest: { counts: { products: 3, transactions: 2 } } })
  // maxChunkRows is 2: 3 products → 2 chunks; tables in the server's order.
  expect(chunkCalls(orgTransfer.calls).map((c) => [c.body.table, c.body.rows.length])).toEqual([
    ['memberships', 1],
    ['categories', 1],
    ['products', 2],
    ['products', 1],
    ['tabs', 1],
    ['transactions', 2],
  ])

  await dialog.getByRole('button', { name: 'Naar de nieuwe organisatie' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Scouts kopie').first()).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('arcanum-admin-current-org'))).toBe('org-imported-1')
})

test('retries a chunk that fails once, and still completes', async ({ console: open, orgTransfer }) => {
  orgTransfer.failNextChunks = 1
  const page = await open('/settings/data')
  await page.getByRole('button', { name: 'Organisatie importeren uit exportbestand' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload(exportFile()))
  await dialog.getByRole('button', { name: 'Importeren' }).click()
  await expect(dialog).toContainText('Import voltooid.')
  const chunks = chunkCalls(orgTransfer.calls)
  expect(chunks.filter((c) => c.status === 500)).toHaveLength(1)
  expect(chunks.filter((c) => c.status === 200)).toHaveLength(6)
})

test('shows which tables are missing at finish, and can abort the import', async ({ console: open, orgTransfer }) => {
  orgTransfer.dropTable = 'products'
  const page = await open('/settings/data')
  await page.getByRole('button', { name: 'Organisatie importeren uit exportbestand' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload(exportFile()))
  await dialog.getByRole('button', { name: 'Importeren' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Niet alle gegevens zijn aangekomen')
  await expect(dialog).toContainText('Producten: 0 van 3')
  await dialog.getByRole('button', { name: 'Import annuleren' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(orgTransfer.calls.some((c) => c.path.endsWith('/import/abort') && c.status === 200)).toBe(true)
  expect(orgTransfer.orgs.map((o) => o.id)).toEqual(['org-e2e'])
})

test('rejects a file that is not an Arcanum export before calling the server', async ({ console: open, orgTransfer }) => {
  const page = await open('/settings/data')
  await page.getByRole('button', { name: 'Organisatie importeren uit exportbestand' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload({ format: 'menukaart', rows: [] }))
  await expect(dialog.getByRole('alert')).toContainText('geen Arcanum-exportbestand')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload(exportFile({ version: 2 })))
  await expect(dialog.getByRole('alert')).toContainText('Exportversie 2')
  expect(orgTransfer.calls.some((c) => c.path.includes('/import/'))).toBe(false)
})

test('resumes an unfinished import from the banner, without starting a new org', async ({ page, console: open, orgTransfer }) => {
  const file = exportFile()
  const counts = Object.fromEntries(Object.entries(file.tables).map(([t, rows]) => [t, (rows as unknown[]).length]))
  const orgId = orgTransfer.addUnfinishedImport('Scouts Elewijt', counts)
  // Resuming has no /start response to read the chunk size from, so the
  // console uses the backend's own limit (org-transfer.ts MAX_CHUNK_ROWS).
  orgTransfer.maxChunkRows = 2000
  await page.addInitScript((id) => localStorage.setItem('arcanum-admin-current-org', id), orgId)

  await open('/dashboard')
  const banner = page.getByRole('alert').filter({ hasText: 'Deze import is niet afgewerkt' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Hervatten' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Exportbestand (.json)').setInputFiles(asUpload(file))
  await expect(dialog.getByLabel('Naam van de organisatie')).toBeDisabled()
  await dialog.getByRole('button', { name: 'Hervatten' }).click()
  await expect(dialog).toContainText('Import voltooid.')
  expect(orgTransfer.calls.some((c) => c.path.endsWith('/import/start'))).toBe(false)
  expect(chunkCalls(orgTransfer.calls).every((c) => c.path === `/api/organizations/${orgId}/import/chunk`)).toBe(true)

  await dialog.getByRole('button', { name: 'Naar de nieuwe organisatie' }).click()
  await expect(banner).toBeHidden()
})

test('cancels an unfinished import from the banner', async ({ page, console: open, orgTransfer }) => {
  const orgId = orgTransfer.addUnfinishedImport('Half', { products: 3 })
  await page.addInitScript((id) => localStorage.setItem('arcanum-admin-current-org', id), orgId)
  page.on('dialog', (d) => d.accept())

  await open('/dashboard')
  const banner = page.getByRole('alert').filter({ hasText: 'Deze import is niet afgewerkt' })
  await banner.getByRole('button', { name: 'Annuleren' }).click()
  await expect(banner).toBeHidden()
  expect(orgTransfer.orgs.map((o) => o.id)).toEqual(['org-e2e'])
})

test("offers import from the team switcher's new-organization dialog", async ({ console: open }) => {
  const page = await open('/dashboard')
  await page.getByRole('button', { name: /E2E/ }).first().click()
  await page.getByRole('menuitem', { name: 'Nieuwe organisatie' }).click()
  await page.getByRole('button', { name: 'of importeer uit een exportbestand' }).click()
  await expect(page.getByRole('dialog')).toContainText('Organisatie importeren')
  await expect(page.getByRole('dialog').getByLabel('Exportbestand (.json)')).toBeVisible()
})
