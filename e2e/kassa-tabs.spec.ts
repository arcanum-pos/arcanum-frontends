import { expect, panel, test } from './fixtures'

// Kassa flows through tabs (rekeningen). UI behavior only — the fake
// backend mirrors the real rules, but arcanum-backend's own suite is what
// tests those.

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

test('Toog quick sale: build a draft, pay cash, back to Toog for the next customer', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('10')).click()
  await kassa.getByRole('button', button(/^Fietstocht €/)).click()
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

  await kassa.getByRole('button', button(/^Wandeltocht €/)).click()
  await kassa.getByRole('button', button(/^Wandeltocht €/)).click()
  await expect(panel(kassa).getByText('Nieuw — nog niet toegevoegd')).toBeVisible()
  await kassa.getByRole('button', button('Bestelling toevoegen aan rekening')).click()
  await expect(panel(kassa).getByText('2 × Wandeltocht')).toBeVisible()

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
  await kassa.getByRole('button', button('5')).click()
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

test('drafts are kept per tab while switching, and marked in the strip', async ({ kassa, backend }) => {
  backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: 600, quantity: 1 }])
  backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()

  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await expect(panel(kassa).getByText('1 × Wandeltocht')).toBeVisible()
  await kassa.getByRole('button', button('15')).click()

  await kassa.getByRole('button', button(/^#2 Jan/)).click()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(panel(kassa).getByText('Nieuw — nog niet toegevoegd')).toHaveCount(0)

  await kassa.getByRole('button', button(/^#1 Tafel 4 •/)).click()
  await expect(panel(kassa).getByText('Nieuw — nog niet toegevoegd')).toBeVisible()
  await expect(kassa.getByRole('button', button('Afrekenen € 21,00'))).toBeVisible()
})

test('paying a tab submits the pending draft first, then closes the tab', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: 600, quantity: 1 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 4/)).click()
  await kassa.getByRole('button', button('15')).click()

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
  await kassa.getByRole('button', button('Terug naar rekening')).click()

  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(kassa.getByText('Er loopt een betaling')).toHaveCount(0)
  await expect(kassa.getByRole('button', button('Afrekenen € 5,00'))).toBeEnabled()
  expect(tab.status).toBe('open')
  expect(backend.charges.map((c) => c.status)).toEqual(['failed'])
})

test('Bancontact: shows the QR and completes on the devicehub push', async ({ kassa, backend, push }) => {
  await kassa.getByRole('button', button('10')).click()
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

test('Bancontact: going back leaves the charge pending and the tab locked', async ({ kassa, backend }) => {
  await kassa.getByRole('button', button('10')).click()
  await kassa.getByRole('button', button(/^Afrekenen/)).click()
  await kassa.getByRole('button', button('Terug naar rekening')).click()

  // The customer could still scan the QR — failing it here could lose a
  // real payment, so it stays pending until it resolves or times out.
  expect(backend.charges.map((c) => c.status)).toEqual(['pending'])
  await expect(kassa.getByText('Er loopt een betaling voor deze rekening')).toBeVisible()
  await expect(kassa.getByRole('button', button(/^Afrekenen/))).toBeDisabled()
})
