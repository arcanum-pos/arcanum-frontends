import { expect, panel, test } from './fixtures'

// Kassa flows through tabs (rekeningen). UI behavior only — the fake
// backend mirrors the real rules, but arcanum-backend's own suite is what
// tests those.

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

test('Toog quick sale: build a draft, pay cash, back to Toog for the next customer', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByRole('button', button(/^Fietstocht \(niet-lid\)/)).click()
  await expect(panel(kassa).getByText('Te betalen').locator('..')).toContainText('€ 18,00')

  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 18,00')).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  await kassa.getByRole('button', button('Volgende klant')).click()

  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  await expect(kassa.getByRole('button', button(/^#\d/))).toHaveCount(0)
  // A Toog sale is still a real tab — new, closed, with a receipt number.
  expect(backend.tabs).toHaveLength(1)
  expect(backend.tabs[0]).toMatchObject({ label: 'Toog', status: 'closed', receiptNumber: 1 })
})

test('named tab: open, add an order, void part of a line with a reason', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('+ Nieuwe rekening')).click()
  await kassa.getByLabel('Naam of tafel').fill('Tafel 4')
  await kassa.getByRole('button', button('Rekening openen')).click()
  await expect(kassa.getByRole('button', button(/^#1 Tafel 4/))).toBeVisible()

  await kassa.getByRole('button', button(/^Wandeltocht \(niet-lid\)/)).click()
  await kassa.getByRole('button', button(/^Wandeltocht \(niet-lid\)/)).click()
  await expect(panel(kassa).getByText('Nieuw — wordt zo doorgestuurd')).toBeVisible()
  await expect(kassa.getByTestId('order-target')).toContainText('Bestellen voor#1 Tafel 4')
  // No add button: leaving the tab sends the round, as one order.
  await expect(kassa.getByRole('button', { name: /toevoegen aan rekening/ })).toHaveCount(0)
  await kassa.getByRole('button', button(/^Toog/)).click()
  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await expect(panel(kassa).getByText('2 × Wandeltocht')).toBeVisible()
  await expect(panel(kassa).getByText('Nieuw — wordt zo doorgestuurd')).toHaveCount(0)

  await panel(kassa).getByRole('button', button('Annuleren')).click()
  const dialog = kassa.getByRole('dialog')
  await dialog.getByLabel('Aantal annuleren').fill('1')
  // Confirm stays disabled until there's a reason.
  await expect(dialog.getByRole('button', button('Lijn annuleren'))).toBeDisabled()
  await dialog.getByRole('button', button('Klant annuleert')).click()
  await dialog.getByRole('button', button('Lijn annuleren')).click()

  await expect(panel(kassa).getByText('1 × Wandeltocht')).toBeVisible()
  await expect(panel(kassa).getByText('1 geannuleerd')).toBeVisible()
  const voidLine = backend.lines.find((l) => l.voidsLineId)
  expect(voidLine).toMatchObject({ quantity: -1, voidReason: 'Klant annuleert' })
})

test('park a Toog draft on a new named tab', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('5 × Bon')).click()
  await kassa.getByRole('button', button('Op rekening zetten')).click()
  await kassa.getByLabel('Naam of tafel').fill('Jan')
  await kassa.getByRole('button', button('Rekening openen')).click()

  await expect(kassa.getByRole('button', button(/^#1 Jan/))).toBeVisible()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  expect(backend.tabByLabel('Jan')?.status).toBe('open')
  // The Toog draft moved onto the tab — it's gone from Toog.
  await kassa.getByRole('button', button(/^Toog/)).click()
  await expect(panel(kassa).getByText('Nog niets aangeslagen')).toBeVisible()
})

test('switching to another tab sends the round of the one left, as one order', async ({ kassa, backend }) => {
  const tafel4 = backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: 600, quantity: 1 }])
  backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()

  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await expect(panel(kassa).getByText('1 × Wandeltocht')).toBeVisible()
  await kassa.getByRole('button', button('15 × Bon')).click()
  await expect(kassa.getByRole('button', button(/^#1 Tafel 4 •/))).toBeVisible()

  await kassa.getByRole('button', button(/^#2 Jan/)).click()
  await expect(kassa.getByTestId('order-target')).toContainText('#2 Jan')
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(panel(kassa).getByText('Nieuw — wordt zo doorgestuurd')).toHaveCount(0)
  await expect.poll(() => backend.tabLines(tafel4.id).length).toBe(2)

  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await expect(panel(kassa).getByText('15 × Bon')).toBeVisible()
  await expect(panel(kassa).getByText('Nieuw — wordt zo doorgestuurd')).toHaveCount(0)
  await expect(kassa.getByRole('button', button('Afrekenen € 21,00'))).toBeVisible()
})

test('a round left on screen is sent after a pause without taps', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 4')
  await kassa.clock.install()
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await kassa.getByRole('button', button('5 × Bon')).click()
  await kassa.clock.runFor(20_000)
  // Another tap restarts the wait.
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.clock.runFor(20_000)
  expect(backend.tabLines(tab.id)).toHaveLength(0)
  await kassa.clock.runFor(11_000)
  await expect(panel(kassa).getByText('15 × Bon')).toBeVisible()
  expect(backend.tabLines(tab.id)).toHaveLength(1)
  await expect(panel(kassa).getByText('Nieuw — wordt zo doorgestuurd')).toHaveCount(0)
})

test('paying a tab submits the pending draft first, then closes the tab', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: 600, quantity: 1 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await kassa.getByRole('button', button('15 × Bon')).click()

  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 21,00')).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  await kassa.getByRole('button', button('Volgende klant')).click()

  await expect(kassa.getByRole('button', button(/^#1 Tafel 4/))).toHaveCount(0)
  expect(tab.status).toBe('closed')
  expect(backend.charges.filter((c) => c.tabId === tab.id)).toMatchObject([{ status: 'succeeded', amountCents: 2100 }])
})

test('cancelling a cash payment fails it, so the tab can be paid again right away', async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Jan/)).click()

  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 5,00')).click()
  await kassa.getByRole('button', button('Betaling annuleren')).click()

  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(kassa.getByText('Er loopt een betaling')).toHaveCount(0)
  await expect(kassa.getByRole('button', button('Afrekenen € 5,00'))).toBeEnabled()
  expect(tab.status).toBe('open')
  expect(backend.charges.map((c) => c.status)).toEqual(['failed'])
})

test('Bancontact: shows the QR and completes on the devicehub push', async ({ kassa, backend, push }) => {
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByRole('button', button(/^Afrekenen/)).click() // Bancontact is the default method

  await expect(kassa.getByAltText('QR-code voor betaling')).toBeVisible()
  await expect(kassa.getByText('In afwachting')).toBeVisible()
  // Pending Bancontact can't be completed from the kassa itself.
  await expect(kassa.getByRole('button', button('Volgende klant'))).toHaveCount(0)

  const charge = backend.charges[0]
  backend.resolveCharge(charge.id, true)
  push({ event: 'payment_updated', payment_id: charge.id, method: 'bancontact' })

  await expect(kassa.getByText('Betaald')).toBeVisible()
  await kassa.getByRole('button', button('Volgende klant')).click()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
})

// "Ticket annuleren": Afrekenen tapped by mistake — the payment cancelled, then
// the whole ticket at once instead of line by line. Every line voided with the
// one reason, the ticket closed as cancelled; nothing deleted.
test('Afrekenen by mistake: back, then "Ticket annuleren" cancels the whole ticket with one reason', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByRole('button', button(/^Fietstocht \(niet-lid\)/)).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button(/^Afrekenen/)).click()
  await kassa.getByRole('button', button('Betaling annuleren')).click()
  // The sale is a ticket on the server now: no "Leegmaken" — one void per line, or the whole ticket.
  await expect(kassa.getByRole('button', button('Leegmaken'))).toHaveCount(0)

  await kassa.getByRole('button', button('Ticket annuleren')).click()
  const dialog = kassa.getByTestId('cancel-ticket')
  await expect(dialog).toContainText('Alle 11 items (€ 18,00) worden geannuleerd')
  await expect(dialog.getByRole('button', button('Ticket annuleren'))).toBeDisabled()
  await dialog.getByRole('button', button('Verkeerd aangeslagen')).click()
  await dialog.getByRole('button', button('Ticket annuleren')).click()

  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  const tab = backend.tabs.at(-1)!
  expect(tab.status).toBe('cancelled')
  expect(backend.cancelAllRequests).toEqual([{ tabId: tab.id, reason: 'Verkeerd aangeslagen' }])
  // The lines are still there, each with its void.
  const lines = backend.lines.filter((l) => backend.lineTab.get(l.orderId) === tab.id)
  expect(lines.filter((l) => l.quantity < 0).map((l) => [l.name, l.quantity, l.voidReason])).toEqual([
    ['Bon', -10, 'Verkeerd aangeslagen'],
    ['Fietstocht (niet-lid)', -1, 'Verkeerd aangeslagen'],
  ])
})

test('no "Ticket annuleren" while a payment runs, or once something is paid', async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Jan/)).click()
  await expect(kassa.getByRole('button', button('Ticket annuleren'))).toBeEnabled()
  // A payment running for it (e.g. on another kassa): locked.
  backend.startCharge(tab.id, 'bancontact')
  await kassa.getByRole('button', { name: 'Vernieuwen' }).first().click()
  await expect(kassa.getByRole('button', button('Ticket annuleren'))).toBeDisabled()
  expect(tab.status).toBe('open')
})

test('the menu shows what the open tab has, the new round apart — the same as the ticket on the right', async ({ kassa, backend }) => {
  backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', variantId: 'v-wandel', name: 'Wandeltocht', unitPriceCents: 600, quantity: 2 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  const row = kassa.getByRole('button', button(/^Wandeltocht \(niet-lid\)/))
  await expect(row.getByTestId('entry-count')).toHaveText('2×')
  await expect(row.getByTestId('entry-new')).toHaveCount(0)
  await expect(kassa.getByTestId('order-target-summary')).toContainText('2 items · € 12,00')

  await row.click()
  await expect(row.getByTestId('entry-count')).toHaveText('3×')
  await expect(row.getByTestId('entry-new')).toHaveText('+1')
  await expect(kassa.getByTestId('order-target-summary')).toContainText('3 items · € 18,00')
  await expect(kassa.getByTestId('order-target-summary')).toContainText('1 nieuw')
  await expect(panel(kassa).getByText('Te betalen').locator('..')).toContainText('€ 18,00')
  // Right-click only takes back the new one; what's sent stays (a void, with a reason).
  await row.click({ button: 'right' })
  await row.click({ button: 'right' })
  await expect(row.getByTestId('entry-count')).toHaveText('2×')
})

test('cancelling a Bancontact payment stops it (no "payment running" left on the tab), and the CFD rests again', async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Jan/)).click()
  await kassa.getByLabel('Bancontact').check()
  await kassa.getByRole('button', button('Afrekenen € 5,00')).click()
  await kassa.getByRole('button', button('Betaling annuleren')).click()

  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(kassa.getByText('Er loopt een betaling')).toHaveCount(0)
  await expect(kassa.getByRole('button', button('Afrekenen € 5,00'))).toBeEnabled()
  expect(tab.status).toBe('open')
  expect(backend.charges.map((c) => c.status)).toEqual(['failed'])
})

test("Bancontact can't be reached to cancel: the kassa stays on the payment and says to try again", async ({ kassa, backend }) => {
  backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  backend.cancelUnreachable = true
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Jan/)).click()
  await kassa.getByLabel('Bancontact').check()
  await kassa.getByRole('button', button('Afrekenen € 5,00')).click()
  await kassa.getByRole('button', button('Betaling annuleren')).click()
  await expect(kassa.getByText('kon nog niet geannuleerd worden bij de provider')).toBeVisible()
  await expect(kassa.getByRole('button', button('Betaling annuleren'))).toBeVisible()
  backend.cancelUnreachable = false
  await kassa.getByRole('button', button('Betaling annuleren')).click()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  expect(backend.charges.map((c) => c.status)).toEqual(['failed'])
})
