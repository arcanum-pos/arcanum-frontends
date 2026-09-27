import { expect, panel, test } from './fixtures'

// Rekeningen (design_files "Rekeningen"): today's rekeningen of every kassa
// — an open one continues on this kassa, a paid or cancelled one opens
// read-only. "Today" = opened or closed since midnight, or still open.

const yesterday = () => new Date(Date.now() - 36 * 3600 * 1000).toISOString()

test('lists today of every kassa, filters and searches, and opens a rekening', async ({ kassa, backend }) => {
  const open = backend.openTab('Tafel 2', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 4 }])
  const paid = backend.openTab('Tafel 3', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 250, quantity: 2 }])
  backend.resolveCharge(backend.startCharge(paid.id, 'bancontact').id, true)
  const cancelled = backend.openTab('Jan')
  cancelled.status = 'cancelled'
  cancelled.closedAt = new Date().toISOString()
  // Yesterday's paid one is gone; yesterday's still-open one stays.
  const old = backend.openTab('Gisteren betaald')
  old.status = 'closed'
  old.openedAt = yesterday()
  old.closedAt = yesterday()
  const stillOpen = backend.openTab('Gisteren open')
  stillOpen.openedAt = yesterday()

  await kassa.getByRole('button', { name: 'Rekeningen' }).click()
  const overview = kassa.getByTestId('tabs-overview')
  await expect(overview.getByRole('heading', { name: 'Rekeningen van vandaag' })).toBeVisible()
  const rows = overview.getByTestId('overview-row')
  await expect(rows).toHaveCount(4)
  await expect(overview).not.toContainText('Gisteren betaald')
  await expect(rows.filter({ hasText: 'Tafel 3' })).toContainText('2 items')
  await expect(rows.filter({ hasText: 'Tafel 3' })).toContainText('Bancontact')
  await expect(rows.filter({ hasText: 'Tafel 3' })).toContainText('Betaald')
  await expect(rows.filter({ hasText: 'Tafel 2' })).toContainText('Open')
  await expect(overview.getByTestId('overview-totals')).toHaveText('1 betaald · € 5,00 — 2 open · € 4,00')

  await overview.getByRole('button', { name: 'Geannuleerd', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Jan')
  await overview.getByRole('button', { name: 'Alle', exact: true }).click()
  await overview.getByLabel('Zoek op naam, #nummer of bedrag…').fill('5,00')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Tafel 3')

  // A paid one: read-only, with its payment and receipt number.
  await rows.first().click()
  const detail = kassa.getByTestId('tab-detail')
  await expect(detail.getByRole('heading', { name: '#2 Tafel 3' })).toBeVisible()
  await expect(detail).toContainText('Kasticket #1')
  await expect(detail.getByTestId('detail-payment')).toContainText('Bancontact')
  await detail.getByRole('button', { name: 'Sluiten' }).first().click()

  // An open one continues on this kassa.
  await overview.getByLabel('Zoek op naam, #nummer of bedrag…').fill('#1')
  await rows.first().click()
  await expect(kassa.getByTestId('tabs-overview')).toHaveCount(0)
  await expect(panel(kassa).getByRole('heading', { name: /Tafel 2/ })).toBeVisible()
  void open
})

test('a new rekening elsewhere shows up in the overview live', async ({ kassa, backend, push }) => {
  await kassa.getByRole('button', { name: 'Rekeningen' }).click()
  await expect(kassa.getByText('Nog geen rekeningen vandaag.')).toBeVisible()
  const tab = backend.openTab('Tafel 8')
  push({ event: 'tabs_changed', tab_id: tab.id })
  await expect(kassa.getByTestId('overview-row')).toContainText('Tafel 8')
  // And back to the kassa.
  await kassa.getByRole('button', { name: '← Terug naar de kassa' }).click()
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
})
