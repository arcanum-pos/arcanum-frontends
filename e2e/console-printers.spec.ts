// Console → Toestellen: a ticket printer (arcanum/PRINTING.md) is one of the
// device types - added with its address on the network, the stations it
// prints for; changed, sent a test page, removed.
import { expect, rowAction, test } from './console-fixtures'

test('adds an Epson printer for the kitchen; Star and polling are shown as later', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.stations = [
    { id: 'st-k', name: 'Keuken', position: 0 },
    { id: 'st-b', name: 'Bar', position: 1 },
  ] as any
  await open('/devices')
  await page.getByRole('button', { name: 'Toestel toevoegen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Printer' }).click()

  await dialog.getByRole('combobox', { name: 'Merk' }).click()
  await expect(page.getByRole('option', { name: 'Star (later)' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await dialog.getByRole('combobox', { name: 'Verbinding' }).click()
  await expect(page.getByRole('option', { name: 'De printer haalt zelf op (later)' })).toBeDisabled()
  await page.keyboard.press('Escape')

  await expect(dialog.getByRole('button', { name: 'Printer toevoegen' })).toBeDisabled()
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
  catalogAdmin.printers = [{ id: 'pr-1', name: 'Barprinter', brand: 'epson', connection: 'push', host: '192.168.1.60', port: 443, deviceId: 'local_printer', paperMm: 80, stations: [] }]
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
