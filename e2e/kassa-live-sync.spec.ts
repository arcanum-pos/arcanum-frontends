import { expect, panel, test } from './fixtures'

// Rekeningen are the org's, shared by every kassa. Another kassa's change
// arrives live (devicehub's tabs_changed push) — or with Vernieuwen, when
// the push didn't come through.

test("another kassa's new rekening appears live, without touching this one", async ({ kassa, backend, push }) => {
  const tab = backend.openTab('Tafel 9', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 2 }])
  await expect(kassa.getByRole('button', { name: /^#1 Tafel 9/ })).toHaveCount(0)
  push({ event: 'tabs_changed', tab_id: tab.id })
  await expect(kassa.getByRole('button', { name: /^#1 Tafel 9/ })).toBeVisible()
})

test('Vernieuwen pulls the list when no push came', async ({ kassa, backend }) => {
  backend.openTab('Tafel 3')
  await kassa.getByRole('button', { name: 'Vernieuwen' }).first().click()
  await expect(kassa.getByRole('button', { name: /^#1 Tafel 3/ })).toBeVisible()
})

test('the selected rekening follows along: a line added elsewhere shows, a close elsewhere falls back to Toog', async ({ kassa, backend, push }) => {
  const tab = backend.openTab('Tafel 5', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 2 }])
  push({ event: 'tabs_changed', tab_id: tab.id })
  await kassa.getByRole('button', { name: /^#1 Tafel 5/ }).click()
  await expect(panel(kassa).getByText('2 × Bon')).toBeVisible()

  backend.addLines(tab.id, [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 3 }])
  push({ event: 'tabs_changed', tab_id: tab.id })
  await expect(panel(kassa).getByText('3 × Bon')).toBeVisible()

  const charge = backend.startCharge(tab.id, 'cash')
  backend.resolveCharge(charge.id, true)
  push({ event: 'tabs_changed', tab_id: tab.id })
  await expect(kassa.getByText('Deze rekening is intussen afgesloten, mogelijk op een andere kassa.')).toBeVisible()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
})
