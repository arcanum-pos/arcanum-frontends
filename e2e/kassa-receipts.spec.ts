// Receipts at the kassa (arcanum/PRINTING.md): only when the organisation
// has them switched on and this kassa has a printer (Instellingen) - then
// "Bon printen" after a payment, or by itself when the kassa says so.
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })
const PRINTER = { id: 'pr-1', name: 'Toogprinter', brand: 'epson', connection: 'poll', host: null, port: null, deviceId: 'local_printer', paperMm: 80, pollInterval: 10, lastPollAt: null, stations: [] }

async function payCash(kassa: Page) {
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 10,00')).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  await expect(kassa.getByTestId('payment-paid-mark')).toBeVisible()
}

const choose = (kassa: Page, choice: { printerId: string; auto: boolean }) =>
  kassa.evaluate((c) => localStorage.setItem('arcanum-receipt-printer', JSON.stringify({ 'org-e2e': c })), choice)

test('no receipts: no button, even with a printer chosen', async ({ kassa, backend }) => {
  backend.printers = [PRINTER]
  await choose(kassa, { printerId: 'pr-1', auto: false })
  await kassa.reload()
  await payCash(kassa)
  await expect(kassa.getByTestId('receipt')).toHaveCount(0)
})

test('"Bon printen" after the payment sends that tab and payment to the chosen printer', async ({ kassa, backend }) => {
  backend.receiptsEnabled = true
  backend.printers = [PRINTER]
  await choose(kassa, { printerId: 'pr-1', auto: false })
  await kassa.reload()
  await payCash(kassa)
  expect(backend.receipts).toEqual([])
  await kassa.getByRole('button', button('Bon printen')).click()
  await expect(kassa.getByText('Bon naar de printer gestuurd')).toBeVisible()
  const charge = backend.charges.at(-1)!
  expect(backend.receipts).toEqual([{ printerId: 'pr-1', tabId: charge.tabId, chargeId: charge.id, chargeStatus: 'succeeded' }])
  await expect(kassa.getByRole('button', button('Nog een bon'))).toBeVisible()
})

test('by itself after every payment, when this kassa says so', async ({ kassa, backend }) => {
  backend.receiptsEnabled = true
  backend.printers = [PRINTER]
  await choose(kassa, { printerId: 'pr-1', auto: true })
  await kassa.reload()
  await payCash(kassa)
  await expect.poll(() => backend.receipts.length).toBe(1)
  await expect(kassa.getByText('Bon naar de printer gestuurd')).toBeVisible()
})

test('the printer is chosen in Instellingen, only when receipts are on', async ({ kassa, backend }) => {
  backend.printers = [PRINTER]
  await kassa.goto('/settings.html')
  await expect(kassa.getByText('SumUp Solo-reader', { exact: true })).toBeVisible()
  await expect(kassa.getByTestId('receipt-printer')).toHaveCount(0)

  backend.receiptsEnabled = true
  await kassa.reload()
  const panel = kassa.getByTestId('receipt-printer')
  await panel.getByRole('combobox', { name: 'Bonprinter' }).click()
  await kassa.getByRole('option', { name: 'Toogprinter' }).click()
  await panel.getByRole('switch', { name: 'Na elke betaling vanzelf een bon' }).click()
  expect(await kassa.evaluate(() => JSON.parse(localStorage.getItem('arcanum-receipt-printer') || '{}'))).toEqual({ 'org-e2e': { printerId: 'pr-1', auto: true } })
})

test('a cash payment shows as paid at once, but the receipt waits until the backend has recorded it', async ({ kassa, backend }) => {
  backend.receiptsEnabled = true
  backend.printers = [PRINTER]
  await choose(kassa, { printerId: 'pr-1', auto: true })
  await kassa.reload()
  // The backend takes its time recording the payment.
  await kassa.route('**/api/bancontact/sumup/confirm', async (route) => {
    await new Promise((r) => setTimeout(r, 800))
    await route.fallback()
  })
  await payCash(kassa)
  await expect.poll(() => backend.receipts.length).toBe(1)
  expect(backend.receipts[0].chargeStatus).toBe('succeeded')
})
