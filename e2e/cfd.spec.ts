import type { Page, WebSocketRoute } from '@playwright/test'
import { expect, test } from './fixtures'
import type { FakeBackend } from './fake-backend'

// The customer display (display.html), three states: rust, waiting for the
// payment (the order, the total, for Bancontact the QR), and paid ("Bedankt!").
// Fed two ways: the kassa on the same machine (BroadcastChannel), or the
// devicehub push + charge status for a CFD on another device.

async function openDisplay(page: Page, backend: FakeBackend) {
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/display.html?terminal=cfd-e2e')
  await expect(page.getByText('Klaar voor de volgende betaling')).toBeVisible()
  return { push: (msg: Record<string, unknown>) => sockets.forEach((ws) => ws.send(JSON.stringify(msg))), errors }
}

test('same device: the kassa shows the order and the QR on the CFD, then "Bedankt!", and a tap moves the kassa on', async ({ kassa, backend, push }) => {
  const display = await kassa.context().newPage()
  const cfd = await openDisplay(display, backend)

  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await kassa.getByLabel('Fooi').fill('1')
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click() // Bancontact

  const waiting = display.getByTestId('cfd-waiting')
  await expect(waiting.getByText('Jouw bestelling')).toBeVisible()
  await expect(waiting.getByRole('listitem')).toHaveText([/^10\s*Bon\s*€ 10,00$/, /^2\s*Fietstocht \(niet-lid\)\s*€ 16,00$/, /^Fooi\s*€ 1,00$/])
  await expect(waiting.getByText('Totaal te betalen')).toBeVisible()
  await expect(waiting).toContainText('€ 27,00')
  await expect(waiting).toContainText('12 items · Bancontact')
  await expect(waiting.getByAltText('QR-code voor betaling')).toBeVisible()
  await expect(display.getByTestId('cfd-status')).toHaveText('Wachten op je betaling…')
  // A Toog sale has no name to show the customer.
  await expect(waiting.getByRole('heading')).toHaveCount(0)

  const charge = backend.charges[0]
  backend.resolveCharge(charge.id, true)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'bancontact' })

  const paid = display.getByTestId('cfd-paid')
  await expect(paid.getByText('Bedankt!')).toBeVisible()
  await expect(paid).toContainText('€ 27,00 betaald · Bancontact')
  await paid.click()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  await expect(display.getByText('Klaar voor de volgende betaling')).toBeVisible()
  expect(cfd.errors).toEqual([])
})

test('same device, cash: the order and "Gelieve contant te betalen", no QR', async ({ kassa, backend }) => {
  const display = await kassa.context().newPage()
  await openDisplay(display, backend)
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()

  await expect(display.getByTestId('cfd-status')).toHaveText('Gelieve contant te betalen')
  await expect(display.getByTestId('cfd-waiting')).toContainText('5 items · Contant')
  await expect(display.getByAltText('QR-code voor betaling')).toHaveCount(0)

  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await expect(display.getByTestId('cfd-paid')).toContainText('€ 5,00 betaald · Contant')
})

test('another device: the order comes with the charge status (tab name, lines net of voids)', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  const tab = backend.openTab('Tafel 4', [
    { name: 'Pintje', unitPriceCents: 250, quantity: 3 },
    { name: 'Steak (normaal)', unitPriceCents: 3400, quantity: 1 },
  ])
  const charge = backend.startCharge(tab.id, 'cash')
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })

  const waiting = page.getByTestId('cfd-waiting')
  await expect(waiting.getByRole('heading', { name: 'Tafel 4' })).toBeVisible()
  await expect(waiting.getByRole('listitem')).toHaveText([/^3\s*Pintje\s*€ 7,50$/, /^1\s*Steak \(normaal\)\s*€ 34,00$/])
  await expect(waiting).toContainText('€ 41,50')

  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  await expect(page.getByTestId('cfd-paid')).toContainText('€ 41,50 betaald · Contant')

  cfd.push({ event: 'reset' })
  await expect(page.getByText('Klaar voor de volgende betaling')).toBeVisible()
  expect(cfd.errors).toEqual([])
})

test('a failed payment says so, without the QR', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  const tab = backend.openTab('Tafel 1', [{ name: 'Duvel', unitPriceCents: 400, quantity: 2 }])
  const charge = backend.startCharge(tab.id, 'bancontact')
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'bancontact' })
  await expect(page.getByAltText('QR-code voor betaling')).toBeVisible()

  backend.resolveCharge(charge.id, false)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'bancontact' })
  await expect(page.getByTestId('cfd-status')).toHaveText(/mislukt/i)
  await expect(page.getByAltText('QR-code voor betaling')).toHaveCount(0)
  await expect(page.getByTestId('cfd-paid')).toHaveCount(0)
})
