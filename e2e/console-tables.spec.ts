// Console → Tafels and Bediening (release C): tables with their QR codes,
// inviting someone as Bediening, and that role seeing only the waiter screen.
import { expect, test } from './console-fixtures'

test('tables in zones, each with its QR code; all of them on one page to print', async ({ console: open, page, catalogAdmin }) => {
  await open('/tables')
  await expect(page.getByRole('heading', { name: 'Tafels' })).toBeVisible()
  for (const [name, zone] of [['1', 'Zaal'], ['T1', 'Terras']]) {
    await page.getByRole('button', { name: 'Tafel toevoegen' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Naam of nummer').fill(name)
    await dialog.getByLabel('Zone (optioneel)').fill(zone)
    await dialog.getByRole('button', { name: 'Opslaan' }).click()
    await expect(dialog).toBeHidden()
  }
  expect(catalogAdmin.tables.map((t) => [t.name, t.zone])).toEqual([['1', 'Zaal'], ['T1', 'Terras']])
  await expect(page.getByTestId('table-row')).toHaveCount(2)

  await page.getByTestId('table-row').filter({ hasText: 'Tafel T1' }).getByRole('button', { name: 'Tafel T1' }).click()
  await page.getByRole('menuitem', { name: 'QR-code tonen' }).click()
  await expect(page.getByTestId('table-qr')).toContainText('/tafel/qr1abcdefghijklmnop')
  await expect(page.getByTestId('table-qr').locator('svg')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'QR-codes afdrukken' }).click()
  await expect(page.getByTestId('qr-sheet').locator('svg')).toHaveCount(2)
})

// On paper: only the cards (not the console around them), in millimetres for
// A4 — 3 across, 4 down a page, none overlapping, none cut off.
test('printing the QR codes: only the cards, sized for A4, none overlapping', async ({ console: open, page, catalogAdmin, browserName }) => {
  catalogAdmin.tables = Array.from({ length: 14 }, (_, i) => ({ id: `t${i}`, name: String(i + 1).padStart(4, '0'), zone: i % 2 ? 'Terras' : null, position: i, archived: false, state: 'free', qrToken: `qr${i}abcdefghijklmnop` }))
  await open('/tables')
  await page.getByRole('button', { name: 'QR-codes afdrukken' }).click()
  await expect(page.getByTestId('qr-print')).toBeHidden()

  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 794, height: 1123 }) // A4 at 96 dpi
  await expect(page.getByTestId('qr-print')).toBeVisible()
  await expect(page.getByTestId('qr-sheet')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Tafels' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'QR-codes afdrukken' })).toBeHidden()

  const cards = page.getByTestId('qr-print').locator(':scope > div > div')
  await expect(cards).toHaveCount(14)
  const boxes = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))
  // 3 across, inside the page (A4 minus 12 mm margins ≈ 703 px), none overlapping.
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(3)
  for (const b of boxes) expect(b.right).toBeLessThanOrEqual(794)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `cards ${i} and ${j} overlap`).toBe(true)
    }
  // The QR itself: 42 mm (≈ 159 px), not the screen's size.
  const qr = await cards.first().locator('svg').boundingBox()
  expect(Math.round(qr!.width)).toBeGreaterThanOrEqual(157)
  expect(Math.round(qr!.width)).toBeLessThanOrEqual(161)

  // A real print (Chromium makes PDFs): 14 cards, 12 a page → 2 pages.
  if (browserName === 'chromium') {
    const pdf = (await page.pdf({ format: 'A4', preferCSSPageSize: true })).toString('latin1')
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  }
})

test('inviting someone as Bediening', async ({ console: open, page, catalogAdmin }) => {
  await open('/users')
  await page.getByRole('button', { name: /Uitnodigen|Lid uitnodigen/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill('ober@club.test')
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: /Bediening/ }).click()
  await dialog.getByRole('button', { name: 'Uitnodigen' }).click()
  await expect.poll(() => catalogAdmin.members[0]?.role).toBe('waiter')
})

test('the role Bediening: the console points to the waiter screen', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.myRole = 'waiter'
  await open('/dashboard')
  await expect(page.getByTestId('waiter-only')).toContainText('bedieningsscherm')
  await expect(page.getByTestId('waiter-only').getByRole('link', { name: 'Open de bediening' })).toHaveAttribute('href', '/bediening')
})
