import { expect, test } from './fixtures'

// Registers, shifts and kasopmaak on the kassa (release B2): a kassa on a
// register opens the drawer with its float before it sells, sends the
// register with every sale, records cash movements, and closes with the
// kasopmaak; logging out with the drawer open asks first. Without a
// register nothing changes (the other kassa specs).

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

test.beforeEach(async ({ kassa }) => {
  await kassa.addInitScript(() => localStorage.setItem('arcanum-register', JSON.stringify({ orgId: 'org-e2e', id: 'toog', name: 'Toog' })))
  await kassa.reload()
})

test('Kassa openen first; then it sells on the register, the shift in the header', async ({ kassa, backend }) => {
  const open = kassa.getByTestId('open-register')
  await expect(open).toContainText('Kassa openen — Toog')
  await expect(kassa.getByRole('button', button('10 × Bon'))).toHaveCount(0)
  await open.getByLabel('Wisselgeld').fill('50')
  await open.getByRole('button', button('Kassa openen')).click()
  await expect(kassa.getByTestId('shift-label')).toContainText('Toog · shift 1 · open sinds')
  expect(backend.shift.openingFloatCents).toBe(5000)

  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button(/^Afrekenen/)).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  expect(backend.registerIdsSent).toEqual(['toog', 'toog'])
})

test('counted per note and coin; a cash movement; the kasopmaak with its difference and a note; open again from what stayed', async ({ kassa, backend }) => {
  const open = kassa.getByTestId('open-register')
  await open.getByRole('button', button('Per biljet en munt tellen')).click()
  await open.getByLabel('€ 20', { exact: true }).fill('2')
  await open.getByLabel('€ 10', { exact: true }).fill('1')
  await expect(open.getByTestId('count-total')).toHaveText('€ 50,00')
  await open.getByRole('button', button('Kassa openen')).click()
  await expect(kassa.getByTestId('shift-label')).toBeVisible()

  await kassa.getByRole('button', button('Kasbeweging')).click()
  const dialog = kassa.getByRole('dialog')
  await dialog.getByLabel('Bedrag').fill('5')
  await dialog.getByLabel('Reden').fill('IJs')
  await dialog.getByRole('button', button('Opslaan')).click()
  await expect(dialog).toBeHidden()
  expect(backend.shift.movements).toMatchObject([{ direction: 'out', amountCents: 500, reason: 'IJs' }])

  await kassa.getByTestId('open-cash-up').click()
  const cashUp = kassa.getByTestId('cash-up')
  await expect(cashUp.getByTestId('cash-up-expected')).toHaveText('€ 45,00')
  await cashUp.getByLabel('€ 20', { exact: true }).fill('2')
  await cashUp.getByLabel('€ 2', { exact: true }).fill('2')
  await expect(cashUp.getByTestId('cash-up-live-difference')).toHaveText('-€ 1,00')
  await expect(cashUp.getByRole('button', button('Kassa afsluiten'))).toBeDisabled()
  await cashUp.getByLabel('Opmerking').fill('Fout teruggegeven')
  await cashUp.getByLabel('Blijft in de lade').fill('40')
  await cashUp.getByRole('button', button('Kassa afsluiten')).click()
  const done = kassa.getByTestId('cash-up-done')
  await expect(done.getByTestId('cash-up-difference')).toHaveText('-€ 1,00')
  expect(backend.closedShifts[0]).toMatchObject({ countedCents: 4400, leftInDrawerCents: 4000, note: 'Fout teruggegeven' })
  await done.getByRole('button', button('Klaar')).click()
  // Closed: Kassa openen again, from what stayed in the drawer.
  await expect(kassa.getByTestId('open-register').getByLabel('Wisselgeld')).toHaveValue('40,00')
})

test("the kasopmaak counts the cash payments made since the kassa last looked (no reload, no focus)", async ({ kassa }) => {
  const open = kassa.getByTestId('open-register')
  await open.getByLabel('Wisselgeld').fill('50')
  await open.getByRole('button', button('Kassa openen')).click()
  await expect(kassa.getByTestId('shift-label')).toBeVisible()
  for (let i = 0; i < 2; i++) {
    await kassa.getByRole('button', button('10 × Bon')).click()
    await kassa.getByLabel('Contant').check()
    await kassa.getByRole('button', button(/^Afrekenen/)).click()
    await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
    await kassa.getByRole('button', button('Volgende klant')).click()
  }
  await kassa.getByTestId('open-cash-up').click()
  await expect(kassa.getByTestId('cash-up').getByTestId('cash-up-expected')).toHaveText('€ 70,00')
})

test('blind count: no expected amount while counting', async ({ kassa, backend }) => {
  backend.blindCount = true
  await kassa.getByTestId('open-register').getByRole('button', button('Kassa openen')).click()
  await kassa.getByTestId('open-cash-up').click()
  await expect(kassa.getByTestId('cash-up')).toContainText('Het verwachte bedrag zie je na het afsluiten.')
  await expect(kassa.getByTestId('cash-up-expected')).toHaveCount(0)
})

test('logging out with the drawer open asks: kasopmaak, or leave it open', async ({ kassa }) => {
  await kassa.getByTestId('open-register').getByRole('button', button('Kassa openen')).click()
  await kassa.getByRole('link', { name: 'Uitloggen' }).first().click()
  const dialog = kassa.getByRole('dialog')
  await expect(dialog).toContainText('De kassa is nog open')
  await dialog.getByRole('button', button('Kasopmaak')).click()
  await expect(kassa.getByTestId('cash-up')).toBeVisible()
})
