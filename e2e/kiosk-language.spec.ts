import { expect, test } from '@playwright/test'

// The setup screens (chooser, login prompt, device login) speak the device's
// picked language, else the browser's, else Dutch. A pick is remembered on
// the device — the customer display starts from it too (see cfd.spec.ts).

test.describe('browser in French', () => {
  test.use({ locale: 'fr-BE' })

  test('the chooser follows the browser, and a pick sticks over it', async ({ page }) => {
    await page.route(/\/api\/organizations\/memberships/, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { orgId: 'org-1', orgName: 'Scouts', role: 'admin' },
          { orgId: 'org-2', orgName: 'Chiro', role: 'cashier' },
        ]),
      })
    )
    await page.goto('/chooser.html')
    await expect(page.getByRole('heading', { name: 'Pour quelle organisation est cet appareil ?' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await page.getByRole('button', { name: 'Scouts' }).click()
    await expect(page.getByText('Organisation : Scouts')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Écran client/ })).toBeVisible()

    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'What is this device?' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Customer display/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Which organisation is this device for?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the login prompt', async ({ page }) => {
    await page.goto('/login-prompt.html')
    await expect(page.getByText('Connexion requise')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Se connecter pour continuer' })).toBeVisible()
  })
})

test.describe('browser in a language we do not speak', () => {
  test.use({ locale: 'de-DE' })

  test('falls back to Dutch', async ({ page }) => {
    await page.goto('/login-prompt.html')
    await expect(page.getByText('Aanmelden vereist')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  })
})

test.describe('browser in English', () => {
  test.use({ locale: 'en-GB' })

  test('the device login shows its own fallback error when the server gives none', async ({ page }) => {
    await page.route(/\/device\/start/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    await page.goto('/device.html')
    await expect(page.getByText('Sign in on this device')).toBeVisible()
    await expect(page.getByText('Could not create a device code.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
