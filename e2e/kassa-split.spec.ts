import { expect, panel, test } from './fixtures'
import type { Page, WebSocketRoute } from '@playwright/test'

// Split payments, step 1 — "Gelijk verdelen" (DOMAIN_MODEL.md "Split
// payments"): what's open is paid in N equal parts, each with its own
// method and fooi; the plan lives on the rekening.

async function fietstochten(kassa: Page) {
  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ }).click()
  await expect(panel(kassa).getByText('Te betalen').locator('..')).toContainText('€ 26,00')
}

async function payCashPart(kassa: Page, label: string, next: 'Volgend deel' | 'Volgende klant') {
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: label, exact: true }).click()
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: next, exact: true }).click()
}

test('split a Toog sale in 3: each part paid on its own, the last takes the rounding, then back to Toog', async ({ kassa, backend }) => {
  await fietstochten(kassa)
  await panel(kassa).getByRole('button', { name: 'Splitsen', exact: true }).click()

  const dialog = kassa.getByRole('dialog')
  await expect(dialog.getByTestId('split-parts')).toHaveText('2')
  await dialog.getByRole('button', { name: 'Meer personen' }).click()
  await expect(dialog.getByTestId('split-preview')).toHaveText('€ 8,66 + 2 × € 8,67')
  await dialog.getByRole('button', { name: 'In 3 verdelen' }).click()

  // The Toog draft became a real rekening, split in 3.
  await expect(panel(kassa).getByTestId('split-banner')).toContainText('Gesplitst in 3 · deel 1 van 3')
  await expect(kassa.getByRole('button', { name: /^#1 Toog/ })).toContainText('0/3 betaald')

  await payCashPart(kassa, 'Afrekenen deel 1/3 · € 8,66', 'Volgend deel')
  await expect(panel(kassa).getByTestId('split-banner')).toContainText('deel 2 van 3')
  await expect(panel(kassa)).toContainText('Al betaald')
  await expect(panel(kassa).getByText('Nog te betalen').locator('..')).toContainText('€ 17,34')

  // Part 2 with its own fooi.
  await kassa.getByLabel('Fooi').fill('1')
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: 'Afrekenen deel 2/3 · € 9,67', exact: true }).click()
  await expect(kassa.getByTestId('payment-part')).toHaveText('Deel 2 van 3')
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: 'Volgend deel', exact: true }).click()

  await payCashPart(kassa, 'Afrekenen deel 3/3 · € 8,67', 'Volgende klant')
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  expect(backend.tabs[0]).toMatchObject({ status: 'closed', receiptNumber: 1 })
  expect(backend.charges.map((c) => [c.amountCents, c.tipCents, c.splitPart])).toEqual([
    [866, 0, 1],
    [967, 100, 2],
    [867, 0, 3],
  ])
})

test('"Splitsen stoppen" goes back to paying the rest at once', async ({ kassa, backend }) => {
  await fietstochten(kassa)
  await panel(kassa).getByRole('button', { name: 'Splitsen', exact: true }).click()
  await kassa.getByRole('dialog').getByRole('button', { name: 'In 2 verdelen' }).click()
  await payCashPart(kassa, 'Afrekenen deel 1/2 · € 13,00', 'Volgend deel')

  await panel(kassa).getByRole('button', { name: 'Splitsen stoppen' }).click()
  await expect(panel(kassa).getByTestId('split-banner')).toHaveCount(0)
  await payCashPart(kassa, 'Afrekenen € 13,00', 'Volgende klant')
  expect(backend.tabs[0].status).toBe('closed')
})

test('another kassa changed the rekening before a part: 409, refreshed, the part recalculated', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 4', [{ name: 'Pintje', unitPriceCents: 250, quantity: 4 }])
  tab.splitParts = 2
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 4/ }).click()
  await expect(panel(kassa).getByTestId('split-banner')).toContainText('Gesplitst in 2 · deel 1 van 2')

  backend.beforeNextCharge = () => backend.addLines(tab.id, [{ name: 'Water', unitPriceCents: 200, quantity: 1 }])
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: 'Afrekenen deel 1/2 · € 5,00', exact: true }).click()
  await expect(kassa.getByText('Rekening is gewijzigd, herlaad en probeer opnieuw')).toBeVisible()
  await expect(kassa.getByRole('button', { name: 'Afrekenen deel 1/2 · € 6,00', exact: true })).toBeEnabled()
  expect(backend.charges).toHaveLength(0)
})

test('after a part is paid, a void that would go below it is refused with a clear message', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 2', [
    { name: 'Steak', unitPriceCents: 3400, quantity: 1 },
    { name: 'Water', unitPriceCents: 200, quantity: 1 },
  ])
  const charge = backend.startCharge(tab.id, 'cash')
  charge.amountCents = 3000
  backend.resolveCharge(charge.id, true)
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 2/ }).click()

  await panel(kassa).getByRole('button', { name: 'Annuleren' }).first().click()
  const dialog = kassa.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Klant annuleert' }).click()
  await dialog.getByRole('button', { name: 'Lijn annuleren' }).click()
  await expect(kassa.getByText('Er is al een deel betaald — annuleren zou meer terugbetalen dan er open staat')).toBeVisible()
})

test('no "Splitsen" when there is nothing (or less than 2 cents) to split', async ({ kassa }) => {
  await expect(panel(kassa).getByRole('button', { name: 'Splitsen', exact: true })).toHaveCount(0)
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(panel(kassa).getByRole('button', { name: 'Splitsen', exact: true })).toBeVisible()
})

test('the CFD shows the part and what stays open', async ({ kassa, backend }) => {
  const display = await kassa.context().newPage()
  const sockets: WebSocketRoute[] = []
  await display.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await display.route(/\/(api\/|whoami)/, async (route) => {
    const url = new URL(route.request().url())
    const { status, body } = backend.handle(route.request().method(), url.pathname + url.search, null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await display.goto('/display.html?terminal=cfd-e2e')

  await fietstochten(kassa)
  await panel(kassa).getByRole('button', { name: 'Splitsen', exact: true }).click()
  await kassa.getByRole('dialog').getByRole('button', { name: 'In 2 verdelen' }).click()
  await payCashPart(kassa, 'Afrekenen deel 1/2 · € 13,00', 'Volgend deel')

  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: 'Afrekenen deel 2/2 · € 13,00', exact: true }).click()
  const waiting = display.getByTestId('cfd-waiting')
  await expect(waiting).toContainText('Te betalen · deel 2 van 2')
  await expect(display.getByTestId('cfd-summary')).toHaveText('Nog open op de rekening: € 13,00 · Contant')
  await expect(waiting.getByRole('listitem').filter({ hasText: 'Al betaald' })).toContainText('€ 13,00')
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await expect(display.getByTestId('cfd-part')).toHaveText('Deel 2 van 2')
})

// --- Step 2: per item ---

async function tafel5(kassa: Page, backend: import('./fake-backend').FakeBackend) {
  const tab = backend.openTab('Tafel 5', [
    { name: 'Pintje', unitPriceCents: 250, quantity: 3 },
    { name: 'Steak', unitPriceCents: 3400, quantity: 1 },
    { name: 'Water', unitPriceCents: 200, quantity: 2 },
  ])
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 5/ }).click()
  await panel(kassa).getByRole('button', { name: 'Splitsen', exact: true }).click()
  const dialog = kassa.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Per item' }).click()
  await dialog.getByRole('button', { name: 'Items kiezen' }).click()
  await expect(panel(kassa).getByTestId('items-banner')).toBeVisible()
  return tab
}

const itemRow = (kassa: Page, name: string) => panel(kassa).getByTestId('item-row').filter({ hasText: name })

test('per item: each person pays what they had; paid units stay marked; "Alles wat open is" pays the rest', async ({ kassa, backend }) => {
  const tab = await tafel5(kassa, backend)
  const pay = panel(kassa).getByRole('button', { name: /^Afrekenen selectie/ })
  await expect(pay).toBeDisabled()
  // Products can't be added while picking.
  await expect(kassa.getByRole('button', { name: '5 × Bon', exact: true })).toBeDisabled()

  // Person 1: the steak and one pintje.
  await itemRow(kassa, 'Steak').getByRole('button', { name: /^Steak:/ }).click()
  await itemRow(kassa, 'Pintje').getByRole('button', { name: 'meer Pintje' }).click()
  await expect(itemRow(kassa, 'Pintje')).toContainText('1/3')
  await expect(pay).toHaveText('Afrekenen selectie · € 36,50')
  await kassa.getByLabel('Contant').check()
  await pay.click()
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: 'Volgende persoon', exact: true }).click()

  // Back on the rekening, nothing picked, the paid units marked.
  await expect(panel(kassa).getByTestId('items-banner')).toBeVisible()
  await expect(itemRow(kassa, 'Steak')).toContainText('✓ 1 betaald')
  await expect(itemRow(kassa, 'Steak').getByRole('button', { name: /^Steak:/ })).toBeDisabled()
  await expect(itemRow(kassa, 'Pintje')).toContainText('0/2')
  await expect(pay).toHaveText('Afrekenen selectie')

  // Person 2: everything else.
  await panel(kassa).getByRole('button', { name: 'Alles wat open is' }).click()
  await expect(pay).toHaveText('Afrekenen selectie · € 9,00')
  await kassa.getByLabel('Contant').check()
  await pay.click()
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: 'Volgende klant', exact: true }).click()

  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  expect(backend.tabs.find((t) => t.id === tab.id)).toMatchObject({ status: 'closed' })
  expect(backend.charges.map((c) => [c.amountCents, c.lines?.map((l) => l.quantity)])).toEqual([
    [3650, [1, 1]],
    [900, [2, 2]],
  ])
})

test('per item: right-click takes a unit off the selection; "Stoppen" leaves the mode', async ({ kassa, backend }) => {
  await tafel5(kassa, backend)
  const pintje = itemRow(kassa, 'Pintje').getByRole('button', { name: /^Pintje:/ })
  await pintje.click()
  await pintje.click()
  await expect(itemRow(kassa, 'Pintje')).toContainText('2/3')
  await pintje.click({ button: 'right' })
  await expect(itemRow(kassa, 'Pintje')).toContainText('1/3')
  await panel(kassa).getByRole('button', { name: 'Stoppen', exact: true }).click()
  await expect(panel(kassa).getByTestId('items-banner')).toHaveCount(0)
  await expect(panel(kassa).getByRole('button', { name: 'Afrekenen € 45,50', exact: true })).toBeEnabled()
})

test('per item: the CFD lists only what this person pays', async ({ kassa, backend }) => {
  const display = await kassa.context().newPage()
  await display.routeWebSocket(/\/devices\/connect/, () => {})
  await display.route(/\/(api\/|whoami)/, async (route) => {
    const url = new URL(route.request().url())
    const { status, body } = backend.handle(route.request().method(), url.pathname + url.search, null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await display.goto('/display.html?terminal=cfd-e2e')

  await tafel5(kassa, backend)
  await itemRow(kassa, 'Steak').getByRole('button', { name: /^Steak:/ }).click()
  await kassa.getByLabel('Contant').check()
  await panel(kassa).getByRole('button', { name: /^Afrekenen selectie/ }).click()

  const waiting = display.getByTestId('cfd-waiting')
  await expect(waiting.getByText('Jouw deel')).toBeVisible()
  await expect(waiting.getByRole('listitem')).toHaveText([/^1\s*Steak\s*€ 34,00$/])
  await expect(display.getByTestId('cfd-summary')).toHaveText('Nog open op de rekening: € 45,50 · Contant')
})

test('per item: paid units can no longer be cancelled — only the unpaid ones are offered', async ({ kassa, backend }) => {
  await tafel5(kassa, backend)
  await itemRow(kassa, 'Steak').getByRole('button', { name: /^Steak:/ }).click()
  await itemRow(kassa, 'Pintje').getByRole('button', { name: 'meer Pintje' }).click()
  await itemRow(kassa, 'Pintje').getByRole('button', { name: 'meer Pintje' }).click()
  await kassa.getByLabel('Contant').check()
  await panel(kassa).getByRole('button', { name: /^Afrekenen selectie/ }).click()
  await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld' }).click()
  await kassa.getByRole('button', { name: 'Volgende persoon', exact: true }).click()
  await panel(kassa).getByRole('button', { name: 'Stoppen', exact: true }).click()

  // Steak fully paid: no "Annuleren". Pintje: 2 of 3 paid, only 1 can be cancelled.
  const row = (name: string) => panel(kassa).locator('div.border-b').filter({ hasText: name })
  await expect(row('Steak')).toContainText('✓ 1 betaald')
  await expect(row('Steak').getByRole('button', { name: 'Annuleren' })).toHaveCount(0)
  await row('Pintje').getByRole('button', { name: 'Annuleren' }).click()
  // Only the one unpaid pintje: the dialog offers exactly that, no quantity to pick.
  await expect(kassa.getByRole('dialog')).toContainText('1 × Pintje')
  await expect(kassa.getByRole('dialog').getByLabel('Aantal annuleren')).toHaveCount(0)
})
