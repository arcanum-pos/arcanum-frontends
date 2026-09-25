import { expect, panel, test } from './fixtures'

// What this kassa does when another kassa changed the same tab. There's no
// live sync yet — correctness comes from the server refusing stale actions
// (409) and the kassa then reloading.

test('another kassa added a line just before paying: 409, error shown, tab refreshed', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 4', [{ itemCode: 'wandeltocht', name: 'Wandeltocht', unitPriceCents: 600, quantity: 1 }])
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 4/ }).click()
  await expect(panel(kassa).getByText('1 × Wandeltocht')).toBeVisible()

  backend.beforeNextCharge = () => backend.addLines(tab.id, [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', { name: 'Afrekenen € 6,00' }).click()

  await expect(kassa.getByText('Rekening is gewijzigd, herlaad en probeer opnieuw')).toBeVisible()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()
  await expect(kassa.getByRole('button', { name: 'Afrekenen € 11,00' })).toBeEnabled()
  expect(backend.charges).toHaveLength(0)
})

test('a payment running on another kassa locks the tab here', async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  backend.startCharge(tab.id)
  await kassa.reload()

  await expect(kassa.getByRole('button', { name: /^#1 Jan/ })).toContainText('Betaling loopt')
  await kassa.getByRole('button', { name: /^#1 Jan/ }).click()
  await expect(kassa.getByText('Er loopt een betaling voor deze rekening')).toBeVisible()
  await expect(kassa.getByRole('button', { name: /^Afrekenen/ })).toBeDisabled()
  await expect(panel(kassa).getByRole('button', { name: 'Annuleren' })).toBeDisabled()
})

test('a tab closed on another kassa: adding to it is refused and the kassa falls back to Toog', async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Jan/ }).click()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()

  const charge = backend.startCharge(tab.id)
  backend.resolveCharge(charge.id, true)

  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.getByRole('button', { name: 'Bestelling toevoegen aan rekening' }).click()

  await expect(kassa.getByText('Deze rekening is intussen afgesloten, mogelijk op een andere kassa.')).toBeVisible()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  await expect(kassa.getByRole('button', { name: /^#1 Jan/ })).toHaveCount(0)
})

test('an empty tab can be closed; one with lines offers no close button', async ({ kassa, backend }) => {
  backend.openTab('Leeg')
  backend.openTab('Vol', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 1 }])
  await kassa.reload()

  await kassa.getByRole('button', { name: /^#2 Vol/ }).click()
  await expect(panel(kassa).getByText('1 × Bon')).toBeVisible()
  await expect(kassa.getByRole('button', { name: 'Lege rekening sluiten' })).toHaveCount(0)

  await kassa.getByRole('button', { name: /^#1 Leeg/ }).click()
  await kassa.getByRole('button', { name: 'Lege rekening sluiten' }).click()
  await expect(kassa.getByRole('button', { name: /^#1 Leeg/ })).toHaveCount(0)
  expect(backend.tabByLabel('Leeg')?.status).toBe('cancelled')
})
