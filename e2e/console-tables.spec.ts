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

// On paper: only the cards, from a document of their own in an invisible
// frame (the console itself is never laid out for paper), in millimetres for
// A4: 3 across, 4 down a page, none overlapping, none cut off.
test('printing the QR codes: a document of their own, 12 cards a page, sized for A4, none overlapping', async ({ console: open, page, catalogAdmin, browserName }) => {
  catalogAdmin.tables = Array.from({ length: 14 }, (_, i) => ({ id: `t${i}`, name: String(i + 1).padStart(4, '0'), zone: i % 2 ? 'Terras' : null, position: i, archived: false, state: 'free', qrToken: `qr${i}abcdefghijklmnop` }))
  // The frame's print dialog: counted, not opened.
  await page.addInitScript(() => {
    window.print = () => {
      ;(window.top as any).__printed = ((window.top as any).__printed ?? 0) + 1
    }
  })
  await open('/tables')
  await page.getByRole('button', { name: 'QR-codes afdrukken' }).click()
  await expect(page.getByTestId('qr-sheet').locator('svg')).toHaveCount(14)
  await page.getByRole('button', { name: 'QR-codes afdrukken' }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(1)

  const frame = page.frameLocator('[data-testid="qr-print-frame"]')
  await expect(frame.locator('.card')).toHaveCount(14)
  await expect(frame.locator('.page')).toHaveCount(2)
  await expect(frame.locator('.page').first().locator('.card')).toHaveCount(12)
  await expect(frame.locator('.card').first()).toContainText('Tafel 0001')
  await expect(frame.locator('.card').nth(1)).toContainText('Terras')
  // The console page itself stays as it is.
  await expect(page.getByRole('link', { name: 'Tafels' })).toBeVisible()

  // The document on its own, as the printer gets it.
  const html = await page.getByTestId('qr-print-frame').evaluate((f) => (f as HTMLIFrameElement).contentDocument!.documentElement.outerHTML)
  const sheet = await page.context().newPage()
  await sheet.setContent(html)
  await sheet.emulateMedia({ media: 'print' })
  await sheet.setViewportSize({ width: 794, height: 1123 }) // A4 at 96 dpi
  expect(await sheet.title()).toBe('QR-codes')
  const boxes = await sheet.locator('.card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(3)
  for (const b of boxes) expect(b.right).toBeLessThanOrEqual(794)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `cards ${i} and ${j} overlap`).toBe(true)
    }
  // The QR itself: 42 mm (about 159 px).
  const qr = await sheet.locator('.card svg').first().boundingBox()
  expect(Math.round(qr!.width)).toBeGreaterThanOrEqual(157)
  expect(Math.round(qr!.width)).toBeLessThanOrEqual(161)

  // A real print (Chromium makes PDFs): 14 cards, 12 a page, so 2 pages.
  if (browserName === 'chromium') {
    const pdf = (await sheet.pdf({ format: 'A4', preferCSSPageSize: true })).toString('latin1')
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2)
  }
  await sheet.close()
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
