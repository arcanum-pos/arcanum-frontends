import { expect, test } from './console-fixtures'

// Rapporten page (step 3d). The fake serves whatever report a test sets —
// the aggregation itself is arcanum-backend's (and its suite's) job; this
// checks the page asks for the right period and renders what comes back.

const report = {
  payments: {
    count: 4,
    amountCents: 6150,
    tipCents: 250,
    byMethod: [
      { method: 'bancontact', count: 2, amountCents: 4100, tipCents: 250 },
      { method: 'cash', count: 2, amountCents: 2050, tipCents: 0 },
    ],
  },
  sales: {
    tabCount: 3,
    revenueCents: 4400,
    byCategory: [
      { category: 'Inschrijvingen', quantity: 4, revenueCents: 2600 },
      { category: null, quantity: 18, revenueCents: 1800 },
    ],
    byProduct: [
      { name: 'Fietstocht (niet-lid)', category: 'Inschrijvingen', quantity: 2, revenueCents: 1600 },
      { name: 'Bon', category: null, quantity: 18, revenueCents: 1800 },
      { name: 'Wandeltocht (lid)', category: 'Inschrijvingen', quantity: 2, revenueCents: 1000 },
    ],
    byVat: [
      { vatRateBp: 600, revenueCents: 2600, vatCents: 147 },
      { vatRateBp: null, revenueCents: 1800, vatCents: 0 },
    ],
  },
  legacy: { count: 1, amountCents: 1500, items: { bon: 10, fietstochtMember: 1, fooi: 0 } },
  openTabs: { count: 2, outstandingCents: 1300 },
}

test('shows the sales report for today, then another period', async ({ console, catalogAdmin }) => {
  catalogAdmin.salesReport = { ...catalogAdmin.salesReport, ...report }
  const page = await console('/reports')

  await expect(page.getByRole('heading', { name: 'Rapporten' })).toBeVisible()
  // Revenue excl. tip: tabs € 44,00 + old kassa € 15,00 (its fooi € 0).
  await expect(page.getByTestId('kpi-revenue')).toHaveText('€ 59,00')
  await expect(page.getByTestId('kpi-tips')).toHaveText('€ 2,50')
  await expect(page.getByTestId('kpi-payments')).toHaveText('€ 61,50')
  await expect(page.getByTestId('kpi-open')).toHaveText('€ 13,00')

  const products = page.getByTestId('report-products')
  await expect(products.getByRole('row')).toHaveCount(4)
  await expect(products.getByRole('row').nth(1)).toContainText('Fietstocht (niet-lid)')
  await expect(products.getByRole('row').nth(1)).toContainText('€ 16,00')
  await expect(page.getByTestId('report-categories')).toContainText('Zonder categorie')
  await expect(page.getByTestId('report-methods')).toContainText('Bancontact')
  await expect(page.getByTestId('report-vat')).toContainText('6%')
  await expect(page.getByTestId('report-vat')).toContainText('niet ingesteld')
  await expect(page.getByText('De btw-tarieven zijn voorlopig')).toBeVisible()

  // Today = one local day, midnight to midnight.
  const today = catalogAdmin.reportQueries.at(-1)!
  expect(new Date(today.to).getTime() - new Date(today.from).getTime()).toBeGreaterThanOrEqual(23 * 3600_000)
  expect(new Date(today.from).getHours()).toBe(0)

  await page.getByRole('button', { name: 'Deze maand' }).click()
  await expect.poll(() => new Date(catalogAdmin.reportQueries.at(-1)!.from).getDate()).toBe(1)
})

test('custom period: both chosen days in full, and a reversed range is refused', async ({ console, catalogAdmin }) => {
  const page = await console('/reports')
  await page.getByRole('button', { name: 'Aangepast' }).click()
  await page.getByLabel('Van', { exact: true }).fill('2026-09-01')
  await page.getByLabel('Tot en met').fill('2026-09-14')

  await expect
    .poll(() => catalogAdmin.reportQueries.at(-1))
    .toEqual({ from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 8, 15).toISOString() })

  const before = catalogAdmin.reportQueries.length
  await page.getByLabel('Van', { exact: true }).fill('2026-09-20')
  await expect(page.getByText('Kies een geldige periode')).toBeVisible()
  expect(catalogAdmin.reportQueries.length).toBe(before)
})

test('old-kassa sales get their own block with readable labels', async ({ console, catalogAdmin }) => {
  catalogAdmin.salesReport = { ...catalogAdmin.salesReport, legacy: { count: 3, amountCents: 2350, items: { wandeltocht: 1, bon: 12, fooi: 150 } } }
  const page = await console('/reports')

  const legacy = page.getByTestId('report-legacy')
  await expect(legacy).toContainText('3 betalingen van voor de rekeningen, samen € 23,50')
  await expect(legacy.getByRole('row').nth(0)).toContainText('Bonnen')
  await expect(legacy.getByRole('row').nth(0)).toContainText('12')
  await expect(legacy.getByRole('row').nth(1)).toContainText('Wandeltocht')
  await expect(legacy.getByRole('row').nth(2)).toContainText('€ 1,50')
})

test('no old-kassa block when there are none', async ({ console }) => {
  const page = await console('/reports')
  await expect(page.getByTestId('kpi-revenue')).toHaveText('€ 0,00')
  await expect(page.getByTestId('report-legacy')).toHaveCount(0)
})

test('a non-admin gets a friendly message instead of the report, and still sees the payments', async ({ console, catalogAdmin }) => {
  catalogAdmin.reportStatus = 403
  catalogAdmin.transactions = [
    {
      id: 'tx1',
      amountCents: 1250,
      tipCents: 250,
      description: 'Rekening #1 Toog',
      method: 'cash',
      items: {},
      slotId: null,
      deviceId: null,
      deviceName: 'Toog',
      userName: 'Ann',
      userEmail: null,
      eventId: null,
      tabId: 't1',
      completedAt: new Date().toISOString(),
    },
  ]
  const page = await console('/reports')

  await expect(page.getByText('Verkooprapporten zijn alleen voor beheerders van deze organisatie.')).toBeVisible()
  await expect(page.getByTestId('kpi-revenue')).toHaveCount(0)
  const row = page.getByTestId('transactions').getByRole('row').nth(1)
  await expect(row).toContainText('Rekening #1 Toog')
  await expect(row).toContainText('€ 2,50')
  await expect(row).toContainText('€ 12,50')
})

function tx(id: string, method: string, amountCents: number, eventId: string, at: Date) {
  return { id, amountCents, tipCents: 0, description: `Rekening ${id}`, method, items: {}, slotId: null, deviceId: null, deviceName: 'Toog', userName: null, userEmail: null, eventId, tabId: id, completedAt: at.toISOString() }
}

test('the event filter sits next to the period and narrows the report, the charts and the payments', async ({ console, catalogAdmin }) => {
  // The events are today (choosing one sets the period to its days).
  const today = new Date()
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const event = (id: string, name: string) => ({ id, name, date: day, createdAt: '2026-10-01T10:00:00Z', selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 0 })
  catalogAdmin.events = [event('ev1', 'Fuif'), event('ev2', 'Quiz')]
  const at = (h: number, min: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, min)
  catalogAdmin.transactions = [
    tx('a', 'cash', 500, 'ev1', at(20, 5)),
    tx('b', 'bancontact', 1200, 'ev1', at(20, 10)),
    tx('c', 'sumup', 800, 'ev1', at(21, 40)),
    tx('d', 'cash', 300, 'ev2', at(20, 12)),
    tx('e', 'sumup', 800, 'ev2', at(20, 14)),
  ]
  const page = await console('/reports')

  // All events: one bar per quarter from 20:00 to 22:00, the 20:00 one stacked from three payments.
  const count = page.getByTestId('chart-count')
  await expect(count.getByTestId('chart-count-bar')).toHaveCount(8)
  await expect(count.getByTestId('chart-count-bar').first()).toHaveAttribute('data-total', '4')
  await expect(page.getByTestId('chart-amount-bar').first()).toHaveAttribute('data-total', '2800')
  await expect(page.getByTestId('chart-count-legend')).toHaveText(/Bancontact.*Contant.*SumUp/)
  // Between every two stacked segments the same 2px of surface.
  const gaps = await count.getByTestId('chart-count-bar').first().evaluate((bar) => {
    const boxes = [...bar.querySelectorAll('rect.pointer-events-none, path')].map((el) => (el as SVGGraphicsElement).getBBox()).sort((a, b) => b.y - a.y)
    return boxes.slice(1).map((box, i) => Math.round((boxes[i].y - (box.y + box.height)) * 10) / 10)
  })
  expect(gaps).toEqual([2, 2])
  await expect(page.getByTestId('transactions').getByRole('row')).toHaveCount(6)
  expect(catalogAdmin.reportQueries.at(-1)!.event).toBeUndefined()

  // Hovering a bar shows its numbers per method and the total.
  await count.getByTestId('chart-count-bar').first().locator('rect').first().hover()
  const tooltip = page.getByTestId('chart-count-tooltip')
  await expect(tooltip).toContainText('Contant')
  await expect(tooltip).toContainText('Bancontact')

  await page.getByTestId('report-event').click()
  await page.getByRole('option', { name: /Fuif/ }).click()
  await expect.poll(() => catalogAdmin.reportQueries.at(-1)!.event).toBe('ev1')
  await expect(page.getByTestId('transactions').getByRole('row')).toHaveCount(4)
  await expect(count.getByTestId('chart-count-bar').first()).toHaveAttribute('data-total', '2')
})

test('a month is charted per day, and no payments says so', async ({ console, catalogAdmin }) => {
  const today = new Date()
  catalogAdmin.transactions = [tx('a', 'cash', 500, 'ev1', new Date(today.getFullYear(), today.getMonth(), 1, 12))]
  const page = await console('/reports')
  // (On the 1st that payment is today's.)
  if (today.getDate() !== 1) await expect(page.getByTestId('report-charts')).toContainText('Geen betalingen in deze periode')

  await page.getByRole('button', { name: 'Deze maand' }).click()
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  await expect(page.getByTestId('chart-count-bar')).toHaveCount(days)
  await expect(page.getByTestId('chart-count-bar').first()).toHaveAttribute('data-total', '1')
})

test('choosing an event sets its days as the period; a day of it, or a part, can be chosen after', async ({ console, catalogAdmin }) => {
  const event = (id: string, name: string, date: string, endDate: string) => ({ id, name, date, endDate, createdAt: '2026-09-01T10:00:00Z', selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 0 })
  catalogAdmin.events = [event('ev1', 'Kamp', '2026-09-12', '2026-09-13'), event('ev2', 'Quiz', '2026-10-11', '2026-10-11')]
  catalogAdmin.transactions = [tx('a', 'cash', 500, 'ev1', new Date(2026, 8, 12, 14, 30)), tx('b', 'sumup', 700, 'ev1', new Date(2026, 8, 13, 1, 10))]
  const page = await console('/reports')

  await page.getByTestId('report-event').click()
  await page.getByRole('option', { name: /Kamp - 12\/09\/2026 - 13\/09\/2026/ }).click()
  await expect
    .poll(() => catalogAdmin.reportQueries.at(-1))
    .toEqual({ from: new Date(2026, 8, 12).toISOString(), to: new Date(2026, 8, 14).toISOString(), event: 'ev1' })
  await expect(page.getByRole('button', { name: 'Hele evenement' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Van', { exact: true })).toHaveValue('2026-09-12')
  await expect(page.getByLabel('Van', { exact: true })).toHaveAttribute('min', '2026-09-12')
  await expect(page.getByLabel('Tot en met')).toHaveAttribute('max', '2026-09-13')
  // Two days: per hour, from 14:00 on the first to 02:00 on the second.
  await expect(page.getByTestId('chart-count-bar')).toHaveCount(12)
  await expect(page.getByRole('button', { name: 'Vandaag' })).toHaveCount(0)

  // One button per day of the event.
  const days = page.getByRole('group', { name: 'Periode' }).getByRole('button')
  await expect(days).toHaveCount(3)
  await days.nth(1).click()
  await expect
    .poll(() => catalogAdmin.reportQueries.at(-1))
    .toEqual({ from: new Date(2026, 8, 12).toISOString(), to: new Date(2026, 8, 13).toISOString(), event: 'ev1' })
  await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('chart-count-bar')).toHaveCount(4) // quarters, 14:00 – 15:00

  // Back to all events: the usual periods again.
  await page.getByTestId('report-event').click()
  await page.getByRole('option', { name: 'Alle evenementen' }).click()
  await expect(page.getByRole('button', { name: 'Vandaag' })).toBeVisible()
})
