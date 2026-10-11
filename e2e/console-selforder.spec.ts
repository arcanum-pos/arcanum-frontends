// Console: an event's ordering modes (each its menu), self-ordering (its
// link and QR code) and order numbers; a station screen as a device —
// DOMAIN_MODEL.md "Self-ordering and station screens". Answered by fake-catalog-admin.ts.
import { expect, test } from './console-fixtures'

function call(admin: any, method: string, path: string, body?: unknown) {
  return admin.handle(method, `/api/organizations/org-e2e${path}`, body)
}

test('an event: add an ordering mode with a menu, switch self-ordering on, and get its link and QR code', async ({ console: open, page, catalogAdmin }) => {
  call(catalogAdmin, 'POST', '/catalogs', { name: 'Fuifkaart' })
  catalogAdmin.events = [{ id: 'ev1', name: 'Fuif', date: '2026-10-11', createdAt: '2026-10-01T10:00:00Z', selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 41 }]
  await open('/events')
  const row = page.getByRole('row').filter({ hasText: 'Fuif' })
  await expect(row).toContainText('Uit')
  await row.getByRole('button', { name: 'Instellen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Fuif — instellen' })).toBeVisible()
  // No ordering mode yet: self-ordering can't be switched on.
  await expect(dialog.getByText('Nog geen bestelwijzen.')).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Zelfbestellen' })).toBeDisabled()

  // A mode, free text; then its menu — guests order with it.
  await dialog.getByRole('combobox', { name: 'Nieuwe bestelwijze' }).fill('Ter plaatse')
  await dialog.getByRole('button', { name: 'Toevoegen' }).click()
  const mode = dialog.locator('[data-testid="order-mode"][data-name="Ter plaatse"]')
  await expect(mode).toBeVisible()
  await expect(mode.getByRole('switch', { name: /^Met de QR-code/ })).toBeDisabled()
  await mode.getByRole('combobox', { name: 'Menukaart — Ter plaatse' }).click()
  await page.getByRole('option', { name: 'Fuifkaart' }).click()
  await expect(mode.getByRole('switch', { name: /^Met de QR-code/ })).toBeChecked()
  await expect(mode.getByRole('switch', { name: /^Aan de kassa/ })).toBeChecked()
  await dialog.getByRole('switch', { name: 'Zelfbestellen' }).click()
  const link = dialog.getByTestId('self-order-link')
  await expect(link.getByLabel('Link voor gasten')).toHaveValue(/\/bestel\/code-/)
  await expect(link.locator('svg title')).toHaveText('QR-code om te bestellen')
  expect(catalogAdmin.eventCalls.map((c: any) => c.body)).toEqual([{ name: 'Ter plaatse' }, { catalogId: expect.any(String), selfOrder: true }, { selfOrderEnabled: true }])

  // How guests pay in this mode: the counter by default, Bancontact as well.
  const pay = mode.getByTestId('pay-methods')
  await expect(pay.getByRole('switch', { name: 'Aan de toog, met hun nummer' })).toBeChecked()
  await pay.getByRole('switch', { name: 'Met Bancontact, op hun telefoon' }).click()
  await expect(pay.getByRole('switch', { name: 'Met Bancontact, op hun telefoon' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ payBancontact: true })
  // Ordering on a tab, paid when leaving.
  await pay.getByRole('switch', { name: 'Bijbestellen op hun rekening, betalen bij vertrek' }).click()
  await expect(pay.getByRole('switch', { name: 'Bijbestellen op hun rekening, betalen bij vertrek' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ tabs: true })
  // On a tab: who's behind it, asked when it opens.
  await pay.getByRole('switch', { name: 'Naam en gsm-nummer of e-mail vragen' }).click()
  await expect(pay.getByRole('switch', { name: 'Naam en gsm-nummer of e-mail vragen' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ tabContact: true })

  // Another name in the readable link.
  await link.getByLabel('Naam in de link').fill('Spaghetti Fouriers')
  await link.getByRole('button', { name: 'Wijzig' }).click()
  await expect(link.getByLabel('Link voor gasten')).toHaveValue(/\/bestel\/spaghetti-fouriers-[a-z0-9]{4}$/)
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ linkName: 'Spaghetti Fouriers' })

  // A new link replaces the old one, after confirming.
  const before = await link.getByLabel('Link voor gasten').inputValue()
  page.once('dialog', (d) => d.accept())
  await link.getByRole('button', { name: 'Nieuwe link maken' }).click()
  await expect(link.getByLabel('Link voor gasten')).not.toHaveValue(before)

  // Numbers start again at 1, after confirming.
  await expect(dialog.getByTestId('last-number')).toHaveText('Laatste nummer: #41.')
  page.once('dialog', (d) => d.accept())
  await dialog.getByRole('button', { name: 'Opnieuw vanaf 1' }).click()
  await expect(dialog.getByTestId('last-number')).toHaveText('De volgende bestelling krijgt #1.')

  await page.keyboard.press('Escape')
  await expect(row).toContainText('Aan')
  await expect(row).toContainText('Ter plaatse')
})

test('several ordering modes: renamed, moved, a direct link each, removed — the last QR mode gone switches self-ordering off', async ({ console: open, page, catalogAdmin }) => {
  const menu = call(catalogAdmin, 'POST', '/catalogs', { name: 'Fuifkaart' }).body
  const takeAwayMenu = call(catalogAdmin, 'POST', '/catalogs', { name: 'Take away' }).body
  const qrMode = (id: string, name: string, catalogId: string) => ({ id, name, catalogId, selfOrder: true, kassa: true, payAtCounter: true, payBancontact: false, tabs: false })
  catalogAdmin.events = [
    {
      id: 'ev1',
      name: 'Fuif',
      date: '2026-10-11',
      createdAt: '2026-10-01T10:00:00Z',
      selfOrder: { enabled: true, code: 'code-1' },
      modes: [qrMode('m1', 'Ter plaatse', menu.id), qrMode('m2', 'Meenemen', takeAwayMenu.id)],
      lastOrderNumber: 0,
    },
  ]
  await open('/events')
  await page.getByRole('row').filter({ hasText: 'Fuif' }).getByRole('button', { name: 'Instellen' }).click()
  const dialog = page.getByRole('dialog')
  const modes = dialog.getByTestId('order-mode')
  await expect(modes).toHaveCount(2)
  // Each QR mode a direct link (a poster at the take-away window).
  await expect(modes.nth(1).getByRole('textbox').last()).toHaveValue(/\/bestel\/code-1\?m=m2$/)

  // Renamed (saved when leaving the field), then moved up.
  const name = modes.nth(1).getByRole('textbox', { name: 'Naam van de bestelwijze' })
  await name.fill('Take away')
  await name.press('Enter')
  await expect(page.locator('[data-testid="order-mode"][data-name="Take away"]')).toBeVisible()
  await modes.nth(1).getByRole('button', { name: 'Hoger' }).click()
  await expect(modes.first()).toHaveAttribute('data-name', 'Take away')
  expect(catalogAdmin.eventCalls.map((c: any) => c.body)).toEqual([{ name: 'Take away' }, { move: 'up' }])

  // A kassa-only mode, from the suggestions' wording.
  await dialog.getByRole('combobox', { name: 'Nieuwe bestelwijze' }).fill('Alleen aan de kassa')
  await dialog.getByRole('button', { name: 'Toevoegen' }).click()
  await expect(modes).toHaveCount(3)
  await expect(modes.nth(2).getByRole('switch', { name: /^Met de QR-code/ })).not.toBeChecked()
  await expect(modes.nth(2).getByTestId('pay-methods')).toHaveCount(0)

  // Both QR modes off the QR (one removed, one switched off): self-ordering goes off.
  page.once('dialog', (d) => d.accept())
  await modes.first().getByRole('button', { name: 'Verwijderen' }).click()
  await expect(modes).toHaveCount(2)
  await modes.first().getByRole('switch', { name: /^Met de QR-code/ }).click()
  await expect(dialog.getByRole('switch', { name: 'Zelfbestellen' })).not.toBeChecked()
  await expect(dialog.getByRole('switch', { name: 'Zelfbestellen' })).toBeDisabled()
})

test('an SMS per ordering mode: only when the installation sends SMS', async ({ console: open, page, catalogAdmin }) => {
  const menu = call(catalogAdmin, 'POST', '/catalogs', { name: 'Fuifkaart' }).body
  const mode = { id: 'm1', name: 'Take away', catalogId: menu.id, selfOrder: true, kassa: true, payAtCounter: true, payBancontact: false, tabs: false, notifySms: false }
  catalogAdmin.events = [{ id: 'ev1', name: 'Fuif', date: '2026-10-11', createdAt: '2026-10-01T10:00:00Z', selfOrder: { enabled: true, code: 'c1' }, modes: [mode], sms: false, lastOrderNumber: 0 }]
  await open('/events')
  await page.getByRole('row').filter({ hasText: 'Fuif' }).getByRole('button', { name: 'Instellen' }).click()
  const card = page.getByRole('dialog').getByTestId('order-mode')
  // Not set up in the installer: off, and says where.
  await expect(card.getByRole('switch', { name: 'Sms als het klaar is — Take away' })).toBeDisabled()
  await expect(card).toContainText('dat gebeurt in de installer (Geavanceerd → Sms)')
  await page.keyboard.press('Escape')

  catalogAdmin.events[0].sms = true
  await page.reload()
  await page.getByRole('row').filter({ hasText: 'Fuif' }).getByRole('button', { name: 'Instellen' }).click()
  await card.getByRole('switch', { name: 'Sms als het klaar is — Take away' }).click()
  await expect(card.getByRole('switch', { name: 'Sms als het klaar is — Take away' })).toBeChecked()
  expect(catalogAdmin.eventCalls.at(-1)!.body).toEqual({ notifySms: true })
})

test('Toestel toevoegen: a station screen for one station', async ({ console: open, page, catalogAdmin }) => {
  call(catalogAdmin, 'POST', '/catalog/stations', { name: 'Keuken' })
  call(catalogAdmin, 'POST', '/catalog/stations', { name: 'Bar' })
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Stationscherm' }).click()
  await expect(dialog.getByText('Het scherm toont de bonnen van dit station.')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Station' }).click()
  await page.getByRole('option', { name: 'Bar' }).click()
  await dialog.getByLabel('Naam').fill('Scherm bar')
  await dialog.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(dialog.getByTestId('pairing-code')).toBeVisible()
  expect(catalogAdmin.pairings[0]).toMatchObject({ role: 'station', name: 'Scherm bar', stationId: catalogAdmin.stations.find((s: any) => s.name === 'Bar')!.id })
})

test('a station screen without stations to choose: says where to make one', async ({ console: open, page }) => {
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Stationscherm' }).click()
  await expect(dialog.getByText('Maak eerst een station')).toBeVisible()
  await dialog.getByLabel('Naam').fill('Scherm')
  await expect(dialog.getByRole('button', { name: 'Koppelcode maken' })).toBeDisabled()
})
