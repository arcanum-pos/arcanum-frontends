import { expect, panel, test } from './fixtures'

// Fooi is a tip on the payment (step 3d), not a line on the tab: it's
// added to the charged amount and sent as tipCents, but the tab only needs
// its own total to be paid. The fake backend enforces amount = outstanding
// + tip, like arcanum-backend.

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

test('pay with a typed tip: charged on top, shown on the payment view and to the CFD, tab closes', async ({ kassa, backend }) => {
  // Collect what the kassa broadcasts to a same-device customer display.
  await kassa.evaluate(() => {
    const w = window as unknown as { __cfd: unknown[] }
    w.__cfd = []
    new BroadcastChannel('arcanum-payment').onmessage = (e) => w.__cfd.push(e.data)
  })

  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByLabel('Fooi').fill('2,50')
  await expect(panel(kassa).getByText('waarvan € 2,50 fooi')).toBeVisible()
  // "Te betalen" is the tab; the button is what the customer pays.
  await expect(panel(kassa).getByText('Te betalen').locator('..')).toContainText('€ 10,00')
  await kassa.getByRole('button', button('Afrekenen € 12,50')).click()

  await expect(kassa.getByText('Fooi = € 2,50')).toBeVisible()
  await expect(kassa.getByText('€ 12,50', { exact: true })).toBeVisible()
  expect(backend.charges[0]).toMatchObject({ amountCents: 1250, tipCents: 250 })
  expect(backend.charges[0].body).toMatchObject({ amount: 1250, tipCents: 250 })

  const cfd = await kassa.evaluate(() => (window as unknown as { __cfd: any[] }).__cfd)
  const shown = cfd.find((m) => m.type === 'payment')
  expect(shown).toMatchObject({ amountCents: 1250, tipCents: 250 })
  expect(shown.breakdown).toContain('Fooi = € 2,50')

  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  await kassa.getByRole('button', button('Volgende klant')).click()
  // The tip counts as paid by the customer, not towards the tab — and the
  // tab (€ 10,00) is fully paid, so it's closed.
  expect(backend.tabs[0]).toMatchObject({ status: 'closed', receiptNumber: 1 })
  // Next customer starts without a tip.
  await expect(kassa.getByLabel('Fooi')).toHaveValue('')
})

test('tip quick buttons: +€1, +€2, round up to a whole euro, and clear', async ({ kassa, backend }) => {
  backend.entry('v-bon')!.priceCents = 150
  await kassa.reload()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()

  await kassa.getByRole('button', button('5 × Bon')).click() // € 7,50
  await kassa.getByRole('button', button('+€1')).click()
  await kassa.getByRole('button', button('+€2')).click()
  await expect(kassa.getByLabel('Fooi')).toHaveValue('3,00')
  await expect(kassa.getByRole('button', button('Afrekenen € 10,50'))).toBeVisible()

  await kassa.getByRole('button', button('Afronden')).click()
  await expect(kassa.getByLabel('Fooi')).toHaveValue('0,50')
  await expect(kassa.getByRole('button', button('Afrekenen € 8,00'))).toBeVisible()

  await kassa.getByRole('button', button('Geen fooi')).click()
  await expect(kassa.getByLabel('Fooi')).toHaveValue('')
  await expect(kassa.getByRole('button', button('Afrekenen € 7,50'))).toBeVisible()
})

test('a line added by another kassa just before paying with a tip: 409, no charge, tab refreshed', async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 2', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 2/)).click()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()

  backend.beforeNextCharge = () => backend.addLines(tab.id, [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 1 }])
  await kassa.getByLabel('Contant').check()
  await kassa.getByLabel('Fooi').fill('1')
  await kassa.getByRole('button', button('Afrekenen € 6,00')).click()

  await expect(kassa.getByText('Rekening is gewijzigd, herlaad en probeer opnieuw')).toBeVisible()
  expect(backend.charges).toHaveLength(0)
  // Refreshed: € 6,00 on the tab now, still with the € 1 tip on top.
  await expect(kassa.getByRole('button', button('Afrekenen € 7,00'))).toBeVisible()
})
