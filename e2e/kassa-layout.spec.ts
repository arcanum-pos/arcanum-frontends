import { expect, panel, test } from './fixtures'
import { fakeEntry } from './fake-backend'

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

// Safari once showed each group card cut off after its first row (a
// mis-sized card clipping its rows) until hovered. Every card must fit all
// its rows, also on a wide screen with several groups side by side.
test('every group card shows all its rows, on a wide screen too', async ({ kassa, page, backend }) => {
  const e = (name: string, cents: number) => fakeEntry(`v-${name.replace(/\W/g, '')}`, name, cents, null)
  backend.catalogs = [
    {
      id: 'c-rest',
      name: 'Restaurant',
      isDefault: true,
      archived: false,
      sections: [
        { id: 's-drank', name: 'Drank', entries: ['Duvel', 'Pintje', 'Palm', 'Frisdrank', 'Fruitsap'].map((n) => e(n, 250)) },
        { id: 's-menu', name: 'Menu', entries: ['normaal', 'jeugd', 'kind'].flatMap((v) => ['Steak', 'Vol-au-vent', 'Witloof'].map((p) => e(`${p} (${v})`, 3000))) },
        { id: 's-dessert', name: 'Dessert', entries: ['Dame blanche', 'Tiramisu', 'Kinderdessert', 'Koffiekoek'].map((n) => e(n, 600)) },
      ],
    },
  ]
  for (const width of [2000, 1280]) {
    await page.setViewportSize({ width, height: 1100 })
    await kassa.reload()
    await expect(kassa.getByRole('button', { name: /^Witloof \(kind\)/ })).toBeInViewport()
    for (const last of ['Fruitsap', 'Witloof (kind)', 'Koffiekoek']) {
      const card = kassa.locator('section').filter({ hasText: last })
      const row = kassa.getByRole('button', { name: new RegExp(`^${last.replace(/[()]/g, '\\$&')}`) })
      const [c, r] = [await card.boundingBox(), await row.boundingBox()]
      expect(r!.y + r!.height, `${last} inside its card at ${width}px`).toBeLessThanOrEqual(c!.y + c!.height + 1)
    }
  }
})

test('click adds a product, right-click takes one off again (never below zero, never a submitted line)', async ({ kassa }) => {
  const row = kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ })
  const toog = kassa.getByRole('button', { name: /^Toog/ })
  await row.click()
  await row.click()
  await row.click()
  await expect(row).toContainText('3×')

  await row.click({ button: 'right' })
  await expect(row).toContainText('2×')
  await expect(toog).toContainText('€ 16,00')
  await row.click({ button: 'right' })
  await row.click({ button: 'right' })
  await expect(row).not.toContainText('×')
  await expect(panel(kassa)).toContainText('Nog niets aangeslagen')
  await row.click({ button: 'right' }) // nothing left: no-op
  await expect(toog).toContainText('Direct afrekenen')
  // The browser's own menu doesn't open on a product.
  const prevented = await row.evaluate((el) => !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })))
  expect(prevented).toBe(true)

  // Quick quantities: right-click takes that amount off, the line goes at zero.
  const ten = kassa.getByRole('button', { name: '10 × Bon', exact: true })
  const five = kassa.getByRole('button', { name: '5 × Bon', exact: true })
  await ten.click()
  await ten.click()
  await five.click({ button: 'right' })
  await expect(panel(kassa)).toContainText('15 items')
  await ten.click({ button: 'right' })
  await ten.click({ button: 'right' })
  await expect(panel(kassa)).toContainText('0 items')
})

test('right-click leaves lines already on the rekening alone (those need a void)', async ({ kassa }) => {
  await kassa.getByRole('button', { name: '+ Nieuwe rekening', exact: true }).click()
  await kassa.getByLabel('Naam of tafel').fill('Tafel 2')
  await kassa.getByRole('button', { name: 'Rekening openen', exact: true }).click()
  const row = kassa.getByRole('button', { name: /^Fietstocht \(niet-lid\)/ })
  await row.click()
  await kassa.getByRole('button', { name: 'Bestelling toevoegen aan rekening' }).click()
  await expect(panel(kassa).getByText('1 × Fietstocht (niet-lid)')).toBeVisible()
  await row.click({ button: 'right' })
  await expect(panel(kassa).getByText('1 × Fietstocht (niet-lid)')).toBeVisible()
  await expect(panel(kassa).getByText('Te betalen').locator('..')).toContainText('€ 8,00')
})
