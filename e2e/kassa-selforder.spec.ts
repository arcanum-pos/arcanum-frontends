import { expect, panel, test } from './fixtures'

// Self-orders at the kassa (DOMAIN_MODEL.md "Self-ordering and station
// screens"): a guest comes to the toog and says their number — the kassa
// shows the event's short number, and "#" opens that order.

test('a self-order shows as "Zelfbestelling #5"; typing its number opens it', async ({ kassa, backend }) => {
  const tab = backend.openTab('', [{ name: 'Pils', unitPriceCents: 250, quantity: 2 }])
  tab.eventNumber = 5
  tab.source = 'self_order'
  const other = backend.openTab('Tafel 2', [{ name: 'Cola', unitPriceCents: 220, quantity: 1 }])
  other.eventNumber = 6
  await kassa.reload()
  await expect(kassa.getByRole('button', { name: /^Zelfbestelling #5/ })).toBeVisible()
  await expect(kassa.getByRole('button', { name: /^#6 Tafel 2/ })).toBeVisible()

  const find = kassa.getByLabel('Rekening of #nummer')
  await find.fill('5')
  await find.press('Enter')
  await expect(panel(kassa).getByRole('heading', { name: 'Zelfbestelling #5' })).toBeVisible()
  await expect(find).toHaveValue('')

  await find.fill('#9')
  await find.press('Enter')
  await expect(kassa.getByRole('alert').filter({ hasText: 'Geen open bestelling #9' })).toBeAttached()
  await expect(find).toHaveAttribute('aria-invalid', 'true')
})

test("a guest's tab with contact details: its name, and how to reach them", async ({ kassa, backend }) => {
  const tab = backend.openTab('Jan Peeters', [{ name: 'Pils', unitPriceCents: 250, quantity: 2 }])
  tab.eventNumber = 8
  tab.source = 'self_order'
  tab.contact = { phone: '+32470123456', email: 'jan@example.be' }
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#8 Jan Peeters/ }).click()
  await expect(panel(kassa).getByTestId('tab-contact')).toHaveText('+32470123456 · jan@example.be')
})
