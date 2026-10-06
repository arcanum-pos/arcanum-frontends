import { expect, test } from './fixtures'

// The setup screens (start page, login prompt, device login) speak the device's
// picked language, else the browser's, else Dutch. A pick is remembered on
// the device — the customer display starts from it too (see cfd.spec.ts).

test.describe('browser in French', () => {
  test.use({ locale: 'fr-BE' })

  test('the start page follows the browser, and a pick sticks over it', async ({ page }) => {
    await page.goto('/chooser.html')
    await expect(page.getByRole('heading', { name: 'Que voulez-vous faire ?' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.getByRole('button', { name: 'Coupler', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pair this device' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the login prompt', async ({ page }) => {
    await page.goto('/login-prompt.html')
    await page.route(/\/device\/start/, (route) => route.fulfill({ status: 500, json: {} }))
    await expect(page.getByText('Connexion', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Avec votre téléphone' })).toBeVisible()
  })
})

test.describe('browser in a language we do not speak', () => {
  test.use({ locale: 'de-DE' })

  test('falls back to Dutch', async ({ page }) => {
    await page.route(/\/device\/start/, (route) => route.fulfill({ status: 500, json: {} }))
    await page.goto('/login-prompt.html')
    await expect(page.getByText('Aanmelden', { exact: true }).first()).toBeVisible()
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
