// Weergave → Klantscherm: the customer display's logo and two colours, and
// an event's own colours (Evenementen → Instellen). Only the customer
// display uses them (kassa-event.spec.ts shows it there).
import { expect, test, rowAction } from './console-fixtures'

// A 2×1 red PNG: what an upload is turned into (drawn again on a canvas).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZYAwAMUcD/WcahHgAAAAASUVORK5CYII=', 'base64')

test('an admin sets the colours (typed or picked), uploads a logo and removes it; a half-typed code sends nothing', async ({ console: open, catalogAdmin, page }) => {
  // The logo itself, as the backend serves it publicly.
  await page.route(/\/api\/public\/branding\/[^/]+\/logo\.png/, (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(catalogAdmin.branding.logo?.png ?? '', 'base64') }))
  await open('/settings/appearance')
  const card = page.getByTestId('display-branding')
  await expect(card.getByText('Klantscherm', { exact: true })).toBeVisible()
  await expect(card.getByText('Geen logo')).toBeVisible()

  const primary = card.getByLabel('Hoofdkleur', { exact: true }).last()
  await primary.fill('#1F6B')
  await primary.fill('#1F6B3A')
  await expect.poll(() => catalogAdmin.brandingCalls).toEqual([{ primary: '#1f6b3a' }])
  await card.getByTestId('color-accent').locator('input[type="color"]').fill('#f2c500')
  await expect.poll(() => catalogAdmin.branding).toMatchObject({ primary: '#1f6b3a', accent: '#f2c500' })
  // The preview: the main colour on the total, readable white on green.
  await expect(card.getByTestId('branding-preview').getByText('€ 14,50').locator('..')).toHaveCSS('background-color', 'rgb(31, 107, 58)')

  await card.locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect.poll(() => catalogAdmin.branding.logo?.png.length ?? 0).toBeGreaterThan(0)
  await expect(card.getByTestId('branding-logo')).toBeVisible()
  await card.getByRole('button', { name: 'Verwijderen' }).click()
  await expect(card.getByText('Geen logo')).toBeVisible()
  expect(catalogAdmin.branding.logo).toBeNull()

  await card.getByTestId('color-primary').getByRole('button', { name: 'Wissen' }).click()
  await expect.poll(() => catalogAdmin.branding.primary).toBeNull()
})

test("an event's own colours, or as the organisation", async ({ console: open, catalogAdmin, page }) => {
  catalogAdmin.events = [{ id: 'ev1', name: 'Tornooi', date: '2026-11-01', createdAt: '2026-10-01T10:00:00Z', selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 0 }]
  await open('/events')
  await rowAction(page.getByRole('row').filter({ hasText: 'Tornooi' }), 'Instellen')
  const section = page.getByRole('dialog').getByTestId('event-brand')
  await expect(section.getByText('Zoals de organisatie').first()).toBeVisible()
  await section.getByLabel('Hoofdkleur', { exact: true }).last().fill('#c8102e')
  await expect.poll(() => catalogAdmin.eventCalls.at(-1)?.body).toEqual({ brandPrimary: '#c8102e' })
  await section.getByTestId('color-event-primary').getByRole('button', { name: 'Wissen' }).click()
  await expect.poll(() => catalogAdmin.eventCalls.at(-1)?.body).toEqual({ brandPrimary: null })
})
