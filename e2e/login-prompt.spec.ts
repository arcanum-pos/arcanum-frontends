// The sign-in prompt (the page any protected address shows signed out,
// incl. the root): sign in on this device, or with a phone (the QR code of
// the device grant) — and either way back to the address it was opened at.
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { guardCsp } from './csp-guard'

test.beforeEach(async ({ context }) => {
  guardCsp(context)
})

interface DeviceFake {
  starts: number
  polls: number
  // What the next poll answers.
  next: { status: string; message?: string }
}

async function fakeDeviceGrant(page: Page, expiresIn = 600): Promise<DeviceFake> {
  const fake: DeviceFake = { starts: 0, polls: 0, next: { status: 'pending' } }
  await page.route(/\/device\/start$/, (route) => {
    fake.starts++
    return route.fulfill({
      json: { userCode: `WXYZ-000${fake.starts}`, verificationUriComplete: `https://login.test/device?user_code=WXYZ000${fake.starts}`, pollId: `p${fake.starts}`, interval: 1, expiresIn },
    })
  })
  await page.route(/\/device\/poll/, (route) => {
    fake.polls++
    return route.fulfill({ json: fake.next })
  })
  return fake
}

test('both ways to sign in, with the way back to the page it was opened at', async ({ page }) => {
  await fakeDeviceGrant(page)
  await page.goto('/login-prompt.html?code=K7PM4XQ2')
  await expect(page.getByRole('heading', { name: 'Op dit toestel' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aanmelden' })).toHaveAttribute('href', `/login?returnTo=${encodeURIComponent('/login-prompt.html?code=K7PM4XQ2')}`)
  const phone = page.getByTestId('sign-in-phone')
  await expect(phone.getByRole('heading', { name: 'Met je telefoon' })).toBeVisible()
  await expect(phone.getByTestId('user-code')).toHaveText('WXYZ-0001')
  await expect(phone.locator('svg')).toBeVisible()
})

test('signed in on the phone: the page opens itself again, now signed in', async ({ page }) => {
  const fake = await fakeDeviceGrant(page)
  await page.goto('/login-prompt.html')
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0001')
  const reloaded = page.waitForEvent('load')
  fake.next = { status: 'complete' }
  await reloaded
  expect(new URL(page.url()).pathname).toBe('/login-prompt.html')
})

test('a code renews itself before it expires — no error, no button', async ({ page }) => {
  await page.clock.install()
  const fake = await fakeDeviceGrant(page, 60)
  await page.goto('/login-prompt.html')
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0001')
  await page.clock.runFor(50_000) // 60 s valid, renewed 15 s early
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0002')
  expect(fake.starts).toBe(2)
  await expect(page.getByRole('button', { name: 'Opnieuw proberen' })).toHaveCount(0)
})

test('expired anyway (the device slept): a new code, still no error', async ({ page }) => {
  await page.clock.install()
  const fake = await fakeDeviceGrant(page)
  await page.goto('/login-prompt.html')
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0001')
  fake.next = { status: 'error', message: 'expired_token' }
  await page.clock.runFor(1_500)
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0002')
})

test('refused on the phone: says so, with "Opnieuw proberen"', async ({ page }) => {
  await page.clock.install()
  const fake = await fakeDeviceGrant(page)
  await page.goto('/login-prompt.html')
  await expect(page.getByTestId('user-code')).toBeVisible()
  fake.next = { status: 'error', message: 'access_denied' }
  await page.clock.runFor(1_500)
  await expect(page.getByText('Aanmelden mislukt.')).toBeVisible()
  await expect(page.getByText('access_denied')).toHaveCount(0)
  await page.getByRole('button', { name: 'Opnieuw proberen' }).click()
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0002')
})

test('/device: the phone sign-in alone, then to the start page', async ({ page }) => {
  const fake = await fakeDeviceGrant(page)
  await page.route(/\/$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>start</p>' }))
  await page.goto('/device.html')
  await expect(page.getByText('Aanmelden op dit toestel')).toBeVisible()
  await expect(page.getByTestId('user-code')).toHaveText('WXYZ-0001')
  fake.next = { status: 'complete' }
  await page.waitForURL((url) => url.pathname === '/')
})
