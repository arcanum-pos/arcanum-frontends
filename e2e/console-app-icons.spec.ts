// Console → Instellingen → Weergave → App-iconen: the organisation's own
// icon per page that can be installed as an app, and per prep station. The
// browser makes every size from one image; removing one goes back to the default.
import sharp from 'sharp'
import { expect, test } from './console-fixtures'

// A PNG's own width × height (its IHDR).
const pngSize = (base64: string) => {
  const bytes = Buffer.from(base64, 'base64')
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
}

test.beforeEach(async ({ page, catalogAdmin }) => {
  catalogAdmin.stations = [{ id: 'st-1', name: 'Keuken', position: 0 } as never]
  // The icons themselves (arcanum-bff): some picture.
  const picture = await sharp({ create: { width: 180, height: 180, channels: 3, background: '#888' } }).png().toBuffer()
  await page.route(/\/icons\/org\//, (route) => route.fulfill({ contentType: 'image/png', body: picture }))
})

test('every page that takes an icon, a prep station among them; all the default to start with', async ({ console: open, page }) => {
  await open('/settings/appearance')
  for (const [slot, label] of [
    ['kassa', 'Kassa'],
    ['display', 'Klantscherm'],
    ['waiter', 'Bediening'],
    ['tap', 'Tap to Pay-telefoon'],
    ['selforder', 'Bestellen (gasten)'],
    ['station', 'Stationscherm (standaard)'],
    ['station-st-1', 'Keuken'],
    ['pickup', 'Afhaalscherm'],
    ['entrance', 'Tafelscherm (ingang)'],
    ['console', 'Console (beheer)'],
  ]) {
    const row = page.getByTestId(`app-icon-${slot}`)
    await expect(row).toContainText(label)
    await expect(row).toContainText('Standaard')
    await expect(row.locator('img')).toHaveAttribute('src', new RegExp(`^/icons/org/org-e2e/${slot}-180\\.png`))
  }
  await expect(page.getByTestId('app-icon-station-st-1')).toContainText('Stationscherm')
})

test('uploading one: every size made in the browser, on white; removed, back to the default', async ({ console: open, page, catalogAdmin }) => {
  await open('/settings/appearance')
  const row = page.getByTestId('app-icon-kassa')
  // A wide logo: fitted in whole.
  const logo = await sharp({ create: { width: 600, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer()
  await row.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo })
  await expect(row).toContainText('Eigen icoon')
  const png = catalogAdmin.orgIcons.get('kassa')!.png
  expect(Object.keys(png).sort()).toEqual(['180', '192', '512', '96'])
  for (const size of ['96', '180', '192', '512']) expect(pngSize(png[size])).toBe(`${size}x${size}`)
  // White above and below the logo, the logo in the middle.
  const { data, info } = await sharp(Buffer.from(png['512'], 'base64')).raw().toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
  expect(at(256, 10)).toEqual([255, 255, 255])
  expect(at(256, 256)).toEqual([255, 0, 0])

  await row.getByRole('button', { name: 'Verwijderen' }).click()
  await expect(row).toContainText('Standaard')
  expect(catalogAdmin.orgIcons.has('kassa')).toBe(false)
  await expect(row.getByRole('button', { name: 'Verwijderen' })).toHaveCount(0)
})

test('a prep station gets its own', async ({ console: open, page, catalogAdmin }) => {
  await open('/settings/appearance')
  const row = page.getByTestId('app-icon-station-st-1')
  const logo = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#0a0' } }).png().toBuffer()
  await row.locator('input[type=file]').setInputFiles({ name: 'keuken.png', mimeType: 'image/png', buffer: logo })
  await expect(row).toContainText('Eigen icoon')
  expect(catalogAdmin.orgIcons.has('station-st-1')).toBe(true)
})

test('not an admin: the icons, not the buttons', async ({ console: open, page, catalogAdmin }) => {
  catalogAdmin.myRole = 'cashier'
  await open('/settings/appearance')
  await expect(page.getByTestId('app-icon-kassa')).toBeVisible()
  await expect(page.getByText('Alleen beheerders kunnen de iconen wijzigen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Uploaden' })).toHaveCount(0)
})

test("the console: its own organisation's icon here, and a cookie so arcanum-bff sends it with that icon next time", async ({ console: open, page, context }) => {
  await open('/settings/appearance')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/org/org-e2e/console-180.png')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/icons/org/org-e2e/console.webmanifest?name=Console')
  const cookie = (await context.cookies()).find((c) => c.name === 'arcanum-console-org')
  expect(cookie).toMatchObject({ value: 'org-e2e', path: '/', sameSite: 'Lax' })
})
