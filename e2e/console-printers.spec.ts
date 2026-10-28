// Console → Toestellen: a ticket printer (arcanum/PRINTING.md) is one of the
// device types. By default it asks Arcanum for its work (polling): it gets a
// URL with the steps to put it in the printer. Or a screen on its network
// sends it (push): then its address. Changed, a test page, a new link, removed.
import { expect, rowAction, test } from './console-fixtures'

const STATIONS = [
  { id: 'st-k', name: 'Keuken', position: 0 },
  { id: 'st-b', name: 'Bar', position: 1 },
] as any

async function addPrinter(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Printer' }).click()
  return dialog
}

test('adds a printer that asks for its work: its URL with the steps (10 s, and what that costs)', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations = STATIONS
  await open('/devices')
  const dialog = await addPrinter(page)
  await dialog.getByRole('combobox', { name: 'Merk' }).click()
  await expect(page.getByRole('option', { name: 'Star (later)' })).toBeDisabled()
  await page.keyboard.press('Escape')
  // Polling is the default; no address asked.
  await expect(dialog.getByRole('combobox', { name: 'Verbinding' })).toContainText('De printer haalt zelf op (aangeraden)')
  await expect(dialog.getByLabel('IP-adres of naam')).toHaveCount(0)
  // How often it asks is set in the printer, not here.
  await expect(dialog.getByLabel('Om de hoeveel seconden')).toHaveCount(0)

  await dialog.getByLabel('Naam', { exact: true }).fill('Barprinter')
  await dialog.getByLabel('Bar').check()
  await dialog.getByRole('button', { name: 'Printer toevoegen' }).click()

  const link = dialog.getByTestId('poll-link')
  await expect(link.getByRole('textbox')).toHaveValue(/^http:\/\/localhost:\d+\/api\/public\/print\/epson\/printer-\d+\?key=key-printer-\d+$/)
  await expect(link).toContainText('Server Direct Print')
  await expect(link).toContainText('interval op 10 seconden (dat is 8.640 keer per dag, ongeveer 9%')
  await expect(link).toContainText('terug bij Bewerken')
  await link.getByRole('button', { name: 'Klaar' }).click()

  const row = page.getByTestId('printer-Barprinter')
  await expect(row).toContainText('Haalt zelf op')
  await expect(row).toContainText('Nog niet gevraagd')
  await expect(row.getByTestId('device-offline')).toHaveText('Stil')
  expect(catalogAdmin.printers[0]).toMatchObject({ connection: 'poll', host: null })
})

test('a printer that asked lately shows as polling; editing shows its link; a new link replaces it', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.printers = [{ id: 'pr-1', name: 'Keukenprinter', brand: 'epson', connection: 'poll', host: null, port: null, deviceId: 'local_printer', paperMm: 80, lastPollAt: new Date().toISOString(), stations: [], pollKey: 'kept-key' }]
  await open('/devices')
  const row = page.getByTestId('printer-Keukenprinter')
  await expect(row.getByTestId('device-online')).toHaveText('Haalt op')
  await rowAction(row, 'Bewerken')
  await expect(page.getByTestId('saved-link').getByRole('textbox')).toHaveValue(/\/api\/public\/print\/epson\/pr-1\?key=kept-key$/)
  await page.keyboard.press('Escape')
  page.once('dialog', (d) => d.accept())
  await rowAction(row, 'Nieuwe link')
  await expect(page.getByTestId('poll-link').getByRole('textbox')).toHaveValue(/key=new-key-pr-1$/)
})

test('or one a screen on its network sends to: its address instead', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations = STATIONS
  await open('/devices')
  const dialog = await addPrinter(page)
  await dialog.getByRole('combobox', { name: 'Verbinding' }).click()
  await page.getByRole('option', { name: 'Via een scherm op hetzelfde netwerk' }).click()
  await expect(dialog).toContainText('Werkt alleen in Chrome')
  await dialog.getByLabel('Naam', { exact: true }).fill('Keukenprinter')
  await dialog.getByLabel('IP-adres of naam').fill('192.168.1.50')
  await dialog.getByLabel('Keuken').check()
  await dialog.getByRole('button', { name: 'Printer toevoegen' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Keukenprinter is toegevoegd.')).toBeVisible()
  const row = page.getByTestId('printer-Keukenprinter')
  await expect(row).toContainText('192.168.1.50')
  await expect(row).toContainText('Printer (Epson)')
  await expect(row).toContainText('Print voor Keuken')
  expect(catalogAdmin.printers[0]).toMatchObject({ brand: 'epson', connection: 'push', port: 443, paperMm: 80 })
})

test('changes a printer, sends it a test page, and removes it', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations = [{ id: 'st-b', name: 'Bar', position: 0 }] as any
  catalogAdmin.printers = [{ id: 'pr-1', name: 'Barprinter', brand: 'epson', connection: 'push', host: '192.168.1.60', port: 443, deviceId: 'local_printer', paperMm: 80, pollInterval: 10, lastPollAt: null, stations: [] }]
  await open('/devices')
  const row = page.getByTestId('printer-Barprinter')
  await expect(row).toContainText('Print nog niets')

  await rowAction(row, 'Bewerken')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Poort').fill('8043')
  await dialog.getByLabel('Bar').check()
  await dialog.getByRole('button', { name: 'Opslaan' }).click()
  await expect(row).toContainText('192.168.1.60:8043')
  await expect(row).toContainText('Print voor Bar')

  await rowAction(row, 'Testafdruk')
  await expect(page.getByText('Testafdruk gestuurd naar Barprinter')).toBeVisible()
  expect(catalogAdmin.testPrints).toEqual(['pr-1'])

  page.once('dialog', (d) => d.accept())
  await rowAction(row, 'Verwijderen')
  await expect(row).toHaveCount(0)
})

test('receipts at the kassa and in table service: off until switched on here', async ({ console: open, page, catalogAdmin }) => {
  await open('/devices')
  const setting = page.getByTestId('receipts-setting')
  await expect(setting).toContainText('Geen BTW-kasticket')
  const toggle = setting.getByRole('switch', { name: 'Bonnen printen' })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()
  expect(catalogAdmin.receiptsEnabled).toBe(true)
})
