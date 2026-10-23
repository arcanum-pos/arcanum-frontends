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
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
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
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  await expect(display.getByText('Klaar voor de volgende bestelling')).toBeVisible()
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
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  expect(cfd.errors).toEqual([])
})

// The items per category (the categories the reports use), and once paid the
// confirmation on the same screen: the order stays, a drawn check, a green light.
test('another device: items per category, and "paid" on the same screen as the bill', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  const tab = backend.openTab('Tafel 7', [
    { name: 'Pintje', unitPriceCents: 250, quantity: 3, category: 'Drank' },
    { name: 'Cola', unitPriceCents: 250, quantity: 2, category: 'Drank' },
    { name: 'Frieten', unitPriceCents: 400, quantity: 1, category: 'Eten' },
    { name: 'Bon', unitPriceCents: 100, quantity: 2 },
  ])
  const charge = backend.startCharge(tab.id, 'cash')
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })

  const waiting = page.getByTestId('cfd-waiting')
  await expect(waiting).toContainText('8 items · Contant')
  await expect(waiting.getByTestId('cfd-categories')).toHaveText(/^5 Drank\s*1 Eten\s*2 Andere$/)

  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  const paid = page.getByTestId('cfd-paid')
  await expect(paid.getByText('Bedankt!')).toBeVisible()
  // The bill stays where it was, beside the confirmation.
  await expect(paid.getByRole('listitem')).toHaveCount(4)
  await expect(paid.getByRole('heading', { name: 'Tafel 7' })).toBeVisible()
  await expect(paid.getByTestId('cfd-categories')).toHaveText(/^5 Drank\s*1 Eten\s*2 Andere$/)
  await expect(paid.getByTestId('cfd-paid-mark').locator('svg path')).toHaveCount(1)
  await expect(paid.getByTestId('cfd-status')).toHaveText('€ 18,50 betaald · Contant')
  await expect(paid.getByTestId('cfd-light').locator('.bg-green-500')).toHaveCount(1)
  await expect(paid.getByAltText('QR-code voor betaling')).toHaveCount(0)
  expect(cfd.errors).toEqual([])
})

test('paid, with something to prepare: the QR to follow the order, and its number', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  const tab = backend.openTab('', [{ name: 'Frieten', unitPriceCents: 400, quantity: 1 }])
  tab.eventNumber = 12
  // Only the /volg/<token> path is taken; the QR points at this display's own address.
  tab.followUrl = 'https://elders.test/volg/tok_abcdefghijklmnopqrstu'
  const charge = backend.startCharge(tab.id, 'cash')
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  await expect(page.getByTestId('cfd-waiting')).toBeVisible()
  await expect(page.getByTestId('cfd-follow')).toHaveCount(0)
  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  const follow = page.getByTestId('cfd-follow')
  await expect(follow).toContainText('Je nummer: 12')
  await expect(follow).toContainText('Scan om te volgen wanneer je bestelling klaar is.')
  await expect(follow.locator('svg title')).toHaveText('QR-code om je bestelling te volgen')
  expect(cfd.errors).toEqual([])
})

test('paid, nothing to prepare: no QR', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  const tab = backend.openTab('', [{ name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  const charge = backend.startCharge(tab.id, 'cash')
  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  await expect(page.getByTestId('cfd-paid')).toBeVisible()
  await expect(page.getByTestId('cfd-follow')).toHaveCount(0)
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

test('the customer can switch the language, and the next customer starts in Dutch again', async ({ page, backend }) => {
  const cfd = await openDisplay(page, backend)
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')

  await page.getByRole('button', { name: 'Français' }).click()
  await expect(page.getByText('Prêt pour la prochaine commande')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('button', { name: 'Plein écran' })).toBeVisible()

  const tab = backend.openTab('Tafel 2', [{ name: 'Pintje', unitPriceCents: 250, quantity: 2 }])
  const charge = backend.startCharge(tab.id, 'cash')
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  const waiting = page.getByTestId('cfd-waiting')
  await expect(waiting.getByText('Votre commande')).toBeVisible()
  await expect(waiting).toContainText('2 articles · Espèces')
  await expect(page.getByTestId('cfd-status')).toHaveText('Veuillez payer en espèces')

  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByTestId('cfd-status')).toHaveText('Please pay in cash')
  await expect(waiting).toContainText('2 items · Cash')

  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'cash' })
  await expect(page.getByTestId('cfd-paid')).toContainText('Thank you!')
  await expect(page.getByTestId('cfd-paid')).toContainText('€ 5,00 paid · Cash')

  cfd.push({ event: 'reset' })
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nederlands' })).toHaveAttribute('aria-pressed', 'true')
  expect(cfd.errors).toEqual([])
})

test('same device, SumUp on a reader: the display turns to "Bedankt!" - also when its own status check comes in after the kassa\'s message', async ({ kassa, backend, push }) => {
  // A Solo (or the Virtual Solo) chosen in Instellingen: the charge goes to the reader.
  await kassa.evaluate(() => localStorage.setItem('arcanum-sumup-reader', JSON.stringify({ id: 'rdr_1', name: 'Toog' })))
  await kassa.reload()
  const display = await kassa.context().newPage()
  const cfd = await openDisplay(display, backend)

  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.getByLabel('SumUp').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  const waiting = display.getByTestId('cfd-waiting')
  await expect(waiting).toContainText('€ 10,00')

  // SumUp's callback resolves it ("successful"); devicehub pushes to the kassa and its display.
  const charge = backend.charges[0]
  backend.resolveCharge(charge.id, true)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'sumup' })
  await expect(display.getByTestId('cfd-paid').getByText('Bedankt!')).toBeVisible()
  // The display's own check of the same push, a moment later, keeps it paid.
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'sumup' })
  await display.waitForTimeout(300)
  await expect(display.getByTestId('cfd-paid').getByText('Bedankt!')).toBeVisible()
  expect(cfd.errors).toEqual([])
})

test('another device, SumUp: the push alone turns the display to "Bedankt!"', async ({ page, backend }) => {
  const tab = backend.openTab('Tafel 1', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  const charge = backend.startCharge(tab.id, 'sumup')
  const cfd = await openDisplay(page, backend)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'sumup' })
  await expect(page.getByTestId('cfd-waiting')).toContainText('€ 5,00')
  backend.resolveCharge(charge.id, true)
  cfd.push({ event: 'payment_updated', payment_id: charge.id, method: 'sumup' })
  await expect(page.getByTestId('cfd-paid').getByText('Bedankt!')).toBeVisible()
})

test('the device language picked on the chooser is the CFD\'s home language, not the browser\'s', async ({ page, backend }) => {
  await page.addInitScript(() => localStorage.setItem('arcanum-locale', 'fr'))
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  await page.goto('/display.html?terminal=cfd-e2e')
  await expect(page.getByText('Prêt pour la prochaine commande')).toBeVisible()

  // A customer's pick doesn't change the device's language.
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByText('Ready for the next order')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Prêt pour la prochaine commande')).toBeVisible()
  void backend
})

// While the cashier enters the order (2026-10-18): the customer sees it and
// says whether it's right, before the cashier asks for the payment.
test('same device: the order shows as the cashier taps it in - then the payment takes over, and after it the screen rests', async ({ kassa, backend, push }) => {
  const display = await kassa.context().newPage()
  await openDisplay(display, backend)

  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  const entering = display.getByTestId('cfd-entering')
  await expect(entering.getByRole('listitem')).toHaveText([/^10\s*Bon\s*€ 10,00$/])
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await expect(entering.getByRole('listitem')).toHaveText([/^10\s*Bon\s*€ 10,00$/, /^1\s*Fietstocht \(niet-lid\)\s*€ 8,00$/])
  await expect(display.getByTestId('cfd-entering-total')).toHaveText('€ 18,00')
  await expect(entering).toContainText('Klopt je bestelling? Zeg het aan de kassa.')
  // A Toog sale: no name to show.
  await expect(entering.getByRole('heading')).toHaveCount(0)

  // The cashier asks for the payment: the payment screen.
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  await expect(display.getByTestId('cfd-waiting')).toBeVisible()
  await expect(entering).toHaveCount(0)
  const charge = backend.charges[0]
  backend.resolveCharge(charge.id, true)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'bancontact' })
  await display.getByTestId('cfd-paid').click()
  // The next customer: the resting screen, not the old order.
  await expect(display.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  await expect(entering).toHaveCount(0)
})

test('the kassa sends the order on its screen to the backend, for a display on another device; emptied, nothing', async ({ kassa, backend }) => {
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect.poll(() => backend.customerViewPuts.at(-1)?.order?.lines).toEqual([{ name: 'Bon', quantity: 5, unitPriceCents: 100, category: null }])
  expect(backend.customerViewPuts.at(-1)?.terminal).toBe('pos-e2e')
  await kassa.getByRole('button', { name: 'Leegmaken' }).click()
  await expect.poll(() => backend.customerViewPuts.at(-1)?.order).toBeNull()
  // Each newer than the one before.
  const seqs = backend.customerViewPuts.map((p) => p.seq)
  expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
})

test('another device: the order being entered comes after the push - the newest wins', async ({ page, backend }) => {
  await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'cfd-2', role: 'cfd', orgId: 'org-e2e', orgName: 'E2E' })))
  backend.devices.set('cfd-2', { terminal_id: 'cfd-2', org_id: 'org-e2e', role: 'cfd', linked_to: 'pos-e2e', name: 'Scherm' })
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
  await page.goto('/display.html')
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  await expect.poll(() => sockets.length).toBeGreaterThan(0)

  backend.customerView = { order: { label: 'Tafel 4', number: 12, eventName: null, paidCents: 250, lines: [{ name: 'Pintje', quantity: 3, unitPriceCents: 250 }] }, seq: 10 }
  sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'order_shown' })))
  const entering = page.getByTestId('cfd-entering')
  await expect(entering.getByRole('heading', { name: 'Tafel 4' })).toBeVisible()
  await expect(entering.getByRole('listitem').first()).toHaveText(/^3\s*Pintje\s*€ 7,50$/)
  await expect(entering).toContainText('Al betaald')
  await expect(page.getByTestId('cfd-entering-total')).toHaveText('€ 5,00')

  // An older one (arriving late) doesn't replace it.
  backend.customerView = { order: null, seq: 9 }
  sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'order_shown' })))
  await page.waitForTimeout(300)
  await expect(entering).toBeVisible()
  // Emptied: the resting screen.
  backend.customerView = { order: null, seq: 11 }
  sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'order_shown' })))
  await expect(page.getByText('Klaar voor de volgende bestelling')).toBeVisible()
})

// "Bestelling tonen" on the kassa (per kassa, remembered): off, the display
// rests while the cashier taps or checks tabs — the payment always shows it.
test('"Bestelling tonen" off: the display rests while the order is entered - the payment still shows it all', async ({ kassa, backend }) => {
  const display = await kassa.context().newPage()
  await openDisplay(display, backend)
  const toggle = kassa.getByTestId('show-order')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(display.getByTestId('cfd-entering')).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(display.getByText('Klaar voor de volgende bestelling')).toBeVisible()
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await kassa.waitForTimeout(400)
  await expect(display.getByTestId('cfd-entering')).toHaveCount(0)
  // Nothing for a display on another device either.
  await expect.poll(() => backend.customerViewPuts.at(-1)?.order).toBeNull()

  // The payment: every detail, as always.
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  const waiting = display.getByTestId('cfd-waiting')
  await expect(waiting.getByRole('listitem')).toHaveText([/^5\s*Bon\s*€ 5,00$/, /^1\s*Fietstocht \(niet-lid\)\s*€ 8,00$/])
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await expect(display.getByTestId('cfd-paid')).toBeVisible()

  // Remembered on this kassa.
  await kassa.reload()
  await expect(kassa.getByTestId('show-order')).toHaveAttribute('aria-pressed', 'false')
  await kassa.getByTestId('show-order').click()
  await expect(kassa.getByTestId('show-order')).toHaveAttribute('aria-pressed', 'true')
})
