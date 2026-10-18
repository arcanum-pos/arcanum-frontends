// Console → Toestellen: pairing a SumUp reader by the code it shows, and
// unpairing one. SumUp is answered by the fake backend (fake-catalog-admin.ts).
import { expect, test } from './console-fixtures'

// "Kopieer link" in the code dialog: what it put on the clipboard.
async function copiedLink(page: import('@playwright/test').Page): Promise<string> {
  await page.evaluate(() => {
    ;(window as any).__copied = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => (window as any).__copied.push(text) }, configurable: true })
  })
  await page.getByRole('dialog').getByRole('button', { name: 'Kopieer link' }).click()
  return (await page.evaluate(() => (window as any).__copied))[0]
}

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
  await expect(code.getByTestId('pairing-qr').locator('svg')).toBeVisible() // the QR
  // The device opens <installation>/pair (or scans the QR, which points there with the code).
  await expect(dialog).toContainText('/pair en geef deze code in')
  await expect(dialog).toContainText('een kassa vraagt je eerst aan te melden')
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'pos', name: 'Kassa toog' })
  // The link carries the device (its icon and name for an app installed from it).
  await expect(code).toContainText('installeer je het eerst als app')

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

test('a pickup screen (Afhaalscherm): a station screen for guests, for one station', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations.push({ id: 'st-keuken', name: 'Keuken', position: 0 } as never)
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Afhaalscherm' }).click()
  await expect(dialog).toContainText('Voor de gasten: de nummers van dit station')
  await dialog.getByLabel('Naam').fill('Afhaal keuken')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'station', stationId: 'st-keuken', view: 'pickup', name: 'Afhaal keuken' })
  // The pickup screen's own icon (Weergave → App-iconen) on the link.
  expect(new URL(await copiedLink(page)).searchParams.get('icon')).toBe('org-e2e/pickup')
  catalogAdmin.claimPairing(catalogAdmin.pairings[0].code)
  await expect(dialog.getByTestId('pairing-claimed')).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  const row = page.getByRole('row').filter({ hasText: 'Afhaal keuken' })
  await expect(row).toContainText('Afhaalscherm')
  await expect(row).toContainText('Station: Keuken')
})

test('a table screen at the entrance: no station to choose', async ({ console: open, page, catalogAdmin }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Tafelscherm (ingang)' }).click()
  await expect(dialog).toContainText('welke beloofde tafel klaar is')
  await expect(dialog.getByRole('combobox', { name: 'Station' })).toHaveCount(0)
  await dialog.getByLabel('Naam').fill('Ingang')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'station', stationId: null, view: 'tables', name: 'Ingang' })
  expect(new URL(await copiedLink(page)).searchParams.get('icon')).toBe('org-e2e/entrance')
})

test("a prep station's screen: its link carries that station's icon", async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations.push({ id: 'st-keuken', name: 'Keuken', position: 0 } as never)
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Stationscherm' }).click()
  await dialog.getByLabel('Naam').fill('Scherm keuken')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  const link = new URL(await copiedLink(page))
  expect(Object.fromEntries(link.searchParams)).toMatchObject({ role: 'station', name: 'Scherm keuken', icon: 'org-e2e/station-st-keuken' })
})

test("a kassa's Tap to Pay phone: always for a kassa; its QR opens the phone's own page", async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.orgDevices = [
    { terminal_id: 'pos-1', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: true, name: 'Kassa toog' },
    { terminal_id: 'pos-2', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: true, name: 'Kassa terras' },
  ]
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Tap to Pay-telefoon' }).click()
  await expect(dialog).toContainText('Een telefoon met de SumUp-app')
  // No "link later": the first kassa to start with.
  await expect(dialog.getByRole('combobox', { name: 'Voor welke kassa?' })).toHaveText('Kassa toog')
  await dialog.getByRole('combobox', { name: 'Voor welke kassa?' }).click()
  await expect(page.getByRole('option')).toHaveText(['Kassa toog', 'Kassa terras'])
  await page.getByRole('option', { name: 'Kassa terras' }).click()
  await dialog.getByLabel('Naam').fill('Telefoon terras')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'tap', name: 'Telefoon terras', linkTo: 'pos-2' })
  // Its link to copy too: the phone's own page (/tap) with the code and its icon — no app advice.
  const link = new URL(await copiedLink(page))
  expect(link.pathname).toBe('/tap')
  expect(Object.fromEntries(link.searchParams)).toEqual({ code: 'K7PM4XQ1', icon: 'org-e2e/tap' })
  await expect(dialog).not.toContainText('installeer je het eerst als app')
})

test('a Tap to Pay phone needs a kassa first', async ({ console: open, page }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Tap to Pay-telefoon' }).click()
  await dialog.getByLabel('Naam').fill('Telefoon')
  await expect(dialog).toContainText('Koppel eerst een kassa')
  await expect(dialog.getByRole('button', { name: 'Koppelcode maken' })).toBeDisabled()
})

// Several devices on one Mac: each its own app in Safari's Dock (its own
// storage). "Open op deze computer" only where the console itself runs in
// Safari; in another browser on a Mac: open the link in Safari.
test.describe('the pairing link on this computer', () => {
  const pairing = async (open: (path: string) => Promise<unknown>, page: import('@playwright/test').Page) => {
    await open('/devices')
    await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Naam').fill('Kassa toog')
    await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
    return dialog.getByTestId('pairing-code')
  }

  test.describe('console in Safari on a Mac', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15' })
    test('"Open op deze computer": the link, in a new tab', async ({ console: open, page }) => {
      const code = await pairing(open, page)
      const link = code.getByRole('link', { name: 'Open op deze computer' })
      await expect(link).toHaveAttribute('href', `${new URL(page.url()).origin}/pair?code=K7PM4XQ1&role=pos&name=Kassa+toog&icon=org-e2e%2Fkassa`)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(code).not.toContainText('open hem in Safari')
    })
  })

  test.describe('console in Chrome on a Mac', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' })
    test('no "Open op deze computer" (Chrome would pair its own profile): copy the link into Safari', async ({ console: open, page }) => {
      const code = await pairing(open, page)
      await expect(code.getByRole('link', { name: 'Open op deze computer' })).toHaveCount(0)
      await expect(code.getByRole('button', { name: 'Kopieer link' })).toBeVisible()
      await expect(code).toContainText('Kopieer de link en open hem in Safari')
    })
  })
})

// "Opnieuw koppelen" (DOMAIN_MODEL.md "Devices", re-pairing): a code that
// makes a browser this existing device again — the same device in the list.
test('a device that lost its pairing: "Opnieuw koppelen" gives a code for that device; claimed, it is the same device', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.orgDevices = [
    { terminal_id: 'pos-1', role: 'pos', linked_to: null, created_at: '2026-10-01T10:00:00Z', online: false, name: 'Kassa toog' },
    { terminal_id: 'display-of-pos-1', role: 'cfd', linked_to: 'pos-1', created_at: '2026-10-01T10:00:00Z', online: false, name: 'Kassa toog · klantscherm' },
  ]
  await open('/devices')
  // A kassa's own second window has no pairing of its own.
  await page.getByRole('button', { name: 'Acties voor Kassa toog · klantscherm' }).click()
  await expect(page.getByRole('menuitem', { name: 'Opnieuw koppelen' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Acties voor Kassa toog', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Opnieuw koppelen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Kassa toog opnieuw koppelen' })).toBeVisible()
  await expect(dialog).toContainText('Het blijft hetzelfde toestel')
  const code = dialog.getByTestId('pairing-code')
  await expect(code).toContainText('K7PM-4XQ1')
  await expect(code.getByTestId('pairing-qr').locator('svg')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'pos', name: 'Kassa toog', repairs: 'pos-1' })

  catalogAdmin.claimPairing('K7PM-4XQ1')
  await expect(dialog.getByTestId('pairing-claimed')).toHaveText('Kassa toog is opnieuw gekoppeld.', { timeout: 10_000 })
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Kassa toog' })).toHaveCount(2)
})
