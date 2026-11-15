import { expect, test } from './fixtures'

// A local installation with a backup in the cloud (OFFLINE.md) knows
// whether it reaches the internet; without it, card payments don't work.

test('no internet on the box: the kassa says what still works', async ({ kassa, backend }) => {
  backend.internetOnline = false
  await kassa.reload()
  await expect(kassa.getByTestId('internet-bar')).toHaveText('Geen internet: kaart, Tap to Pay en Payconiq werken niet, cash wel. Alles blijft bewaard.')
})

test('online, or no backup at all: no bar', async ({ kassa, backend }) => {
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  await expect(kassa.getByTestId('internet-bar')).toHaveCount(0)
  backend.internetOnline = true
  await kassa.reload()
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  await expect(kassa.getByTestId('internet-bar')).toHaveCount(0)
})
