import { expect, panel, test } from './fixtures'

// What the kassa's layout shows at a glance (styled after design_files/):
// how many of a product are already on the order, the Toog draft's amount
// in the tab strip, and the ticket's item count.

test('the product row, the Toog pill and the ticket follow the order', async ({ kassa }) => {
  const row = kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ })
  const toog = kassa.getByRole('button', { name: /^Toog/ })
  await expect(toog).toContainText('Direct afrekenen')
  await expect(row).not.toContainText('×')

  await row.click()
  await row.click()
  await expect(row).toContainText('2×')
  await expect(row).toHaveAccessibleName(/^Fietstocht \(niet-lid\)/) // the badge isn't read out
  await expect(toog).toContainText('€ 16,00')
  await expect(panel(kassa)).toContainText('2 items')

  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(panel(kassa)).toContainText('7 items')
  await expect(toog).toContainText('€ 21,00')

  await kassa.getByRole('button', { name: 'Leegmaken' }).click()
  await expect(row).not.toContainText('×')
  await expect(toog).toContainText('Direct afrekenen')
})

test('the payment method is a real radio group, styled as tiles', async ({ kassa }) => {
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(kassa.getByRole('radio', { name: 'Bancontact' })).toBeChecked()
  await kassa.getByText('Contant', { exact: true }).click() // the tile, not the hidden input
  await expect(kassa.getByRole('radio', { name: 'Contant' })).toBeChecked()
  await kassa.getByRole('radio', { name: 'Contant' }).press('ArrowRight')
  await expect(kassa.getByRole('radio', { name: 'SumUp' })).toBeChecked()
})
