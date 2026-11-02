import { expect, panel, test } from './fixtures'

// SumUp confirmed by hand ("Bevestig SumUp betaling"), for when SumUp's
// own word doesn't come. Paid only when the backend recorded it: a payment
// the reader already reported as failed was never paid (found on the first
// live day: the kassa said "Betaald" while nothing was recorded).

async function startSumup(kassa: import('@playwright/test').Page) {
  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.getByLabel('SumUp').check()
  await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
  await expect(kassa.getByText('Wacht op SumUp betaling (automatisch, of bevestig hieronder)')).toBeVisible()
}

test('confirmed by hand: paid once the backend recorded it, the tab closes', async ({ kassa, backend }) => {
  await startSumup(kassa)
  await kassa.getByRole('button', { name: 'Bevestig SumUp betaling', exact: true }).click()
  await expect(kassa.getByText('Betaald (SumUp)')).toBeVisible()
  expect(backend.charges[0].status).toBe('succeeded')
  await kassa.getByTestId('payment-next').click()
  expect(backend.tabs[0].status).toBe('closed')
})

test('the reader reports a failure: no confirm by hand, only cancel and try again', async ({ kassa, backend, push }) => {
  await startSumup(kassa)
  backend.resolveCharge(backend.charges[0].id, false)
  push({ event: 'payment_updated', payment_id: backend.charges[0].id, method: 'sumup' })
  await expect(kassa.getByText('SumUp betaling mislukt, er is niets betaald. Annuleer en probeer opnieuw.')).toBeVisible()
  await expect(kassa.getByRole('button', { name: 'Bevestig SumUp betaling' })).toHaveCount(0)
  await kassa.getByTestId('payment-cancel').click()
  await expect(panel(kassa).getByRole('button', { name: /^Afrekenen/ })).toBeEnabled()
})

test('confirmed by hand after it failed (the push not in yet): not shown as paid, the tab stays open', async ({ kassa, backend }) => {
  await startSumup(kassa)
  backend.resolveCharge(backend.charges[0].id, false)
  await kassa.getByRole('button', { name: 'Bevestig SumUp betaling', exact: true }).click()
  await expect(kassa.getByText('SumUp betaling mislukt, er is niets betaald. Annuleer en probeer opnieuw.')).toBeVisible()
  await expect(kassa.getByText('Betaald (SumUp)')).toHaveCount(0)
  await expect(kassa.getByTestId('payment-next')).toHaveCount(0)
  expect(backend.tabs[0].status).toBe('open')
})
