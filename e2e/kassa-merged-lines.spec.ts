import type { WebSocketRoute } from '@playwright/test'
import { expect, panel, test } from './fixtures'

// The same item from several rounds is one row on the ticket and one line
// on the customer display — how it was ordered doesn't matter to the
// customer. A void on the row comes off its latest rounds first.

test('two rounds of the same item: one row on the till and one line on the CFD; a void spread over the rounds', async ({ kassa, backend }) => {
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

  const tab = backend.openTab('Tafel 5', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 2 }])
  backend.addLines(tab.id, [
    { itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 3 },
    { name: 'Water', unitPriceCents: 200, quantity: 1 },
  ])
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 5/ }).click()
  await expect(panel(kassa).getByText('5 × Bon')).toHaveCount(1)
  await expect(panel(kassa).getByText(/× Bon/)).toHaveCount(1)

  // The customer display: one Bon line, the total of both rounds.
  const order = display.getByTestId('cfd-order')
  await expect(order.getByRole('listitem').filter({ hasText: 'Bon' })).toHaveCount(1)
  await expect(order.getByRole('listitem').filter({ hasText: 'Bon' })).toContainText('€ 5,00')

  // Cancel 4 of the 5: 3 off the latest round, 1 off the first.
  await panel(kassa).getByRole('button', { name: 'Annuleren' }).first().click()
  const dialog = kassa.getByRole('dialog')
  await dialog.getByLabel('Aantal annuleren').fill('4')
  await dialog.getByRole('button', { name: 'Klant annuleert' }).click()
  await dialog.getByRole('button', { name: 'Lijn annuleren' }).click()
  await expect(panel(kassa).getByText('1 × Bon')).toBeVisible()
  const [first, latest] = backend.lines.filter((l) => l.name === 'Bon' && !l.voidsLineId)
  const voided = (id: string) => -backend.lines.filter((l) => l.voidsLineId === id).reduce((n, l) => n + l.quantity, 0)
  expect([voided(first.id), voided(latest.id)]).toEqual([1, 3])
})
