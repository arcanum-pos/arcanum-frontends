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
  await page.getByLabel('Van').fill('2026-09-01')
  await page.getByLabel('Tot en met').fill('2026-09-14')

  await expect
    .poll(() => catalogAdmin.reportQueries.at(-1))
    .toEqual({ from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 8, 15).toISOString() })

  const before = catalogAdmin.reportQueries.length
  await page.getByLabel('Van').fill('2026-09-20')
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
