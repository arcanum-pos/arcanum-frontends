import { expect, test } from './fixtures'

// Who's working on the kassa (staff, release B1): chosen in the header,
// sent with every sale; an organisation that requires someone asks first.

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

async function sell(kassa: import('@playwright/test').Page) {
  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button(/^Afrekenen/)).click()
}

test('nobody chosen: selling works as before, recorded without a person', async ({ kassa, backend }) => {
  await expect(kassa.getByTestId('staff-button')).toHaveText('Niemand gekozen')
  await sell(kassa)
  await expect(kassa.getByRole('button', button('Bevestig ontvangst contant geld'))).toBeVisible()
  expect(backend.recordedStaff).toEqual([{ what: 'tab', staff: null }, { what: 'charge', staff: null }])
})

test('a person chosen: every sale carries them — and they stay chosen', async ({ kassa, backend }) => {
  await kassa.getByTestId('staff-button').click()
  await kassa.getByTestId('staff-picker').getByRole('button', { name: 'An', exact: true }).click()
  await expect(kassa.getByTestId('staff-button')).toHaveText('An')
  await sell(kassa)
  await expect(kassa.getByRole('button', button('Bevestig ontvangst contant geld'))).toBeVisible()
  expect(backend.recordedStaff).toEqual([{ what: 'tab', staff: 'tok-an' }, { what: 'charge', staff: 'tok-an' }])
  await kassa.reload()
  await expect(kassa.getByTestId('staff-button')).toHaveText('An')
})

test('required by the organisation: the picker opens right away, without "Niemand"; a sale without a person asks again', async ({ kassa, backend }) => {
  backend.staffRequired = true
  await kassa.reload()
  const picker = kassa.getByTestId('staff-picker')
  await expect(picker).toBeVisible()
  await expect(picker).toContainText('Kies je naam voor je verkoopt.')
  await expect(picker.getByTestId('staff-nobody')).toHaveCount(0)
  await kassa.keyboard.press('Escape')
  await sell(kassa)
  await expect(picker).toBeVisible()
  await picker.getByRole('button', { name: 'An', exact: true }).click()
  await expect(kassa.getByTestId('staff-button')).toHaveText('An')
  await kassa.getByRole('button', button(/^Afrekenen/)).click()
  await expect(kassa.getByRole('button', button('Bevestig ontvangst contant geld'))).toBeVisible()
})

test('the role Bediening: the kassa points to the waiter screen (T6)', async ({ kassa, backend }) => {
  ;(backend as any).memberRole = 'waiter'
  await kassa.reload()
  await expect(kassa.getByTestId('waiter-only').getByRole('link', { name: 'Open de bediening' })).toHaveAttribute('href', '/bediening')
})
