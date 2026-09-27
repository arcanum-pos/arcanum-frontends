import type { Page } from '@playwright/test'
import { expect, panel, test } from './fixtures'
import type { FakeBackend } from './fake-backend'

// The kassa and Instellingen speak the device's language (Instellingen →
// Taal), Dutch until one is picked — never the browser's (Playwright's is
// en-US, and every other kassa spec runs in Dutch).

async function openSettings(kassa: Page, backend: FakeBackend) {
  const settings = await kassa.context().newPage()
  await settings.route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await settings.goto('/settings.html')
  return settings
}

test('Instellingen → Taal: the settings switch right away, the kassa once reopened', async ({ kassa, backend }) => {
  const settings = await openSettings(kassa, backend)
  await expect(settings.getByRole('heading', { name: 'Instellingen' })).toBeVisible()
  await expect(settings.getByText('Actief: standaardmenukaart van de organisatie.')).toBeVisible()

  await settings.getByRole('button', { name: 'Français' }).click()
  await expect(settings.getByRole('heading', { name: 'Paramètres' })).toBeVisible()
  // A status already on screen follows too.
  await expect(settings.getByText('Actif : carte par défaut de l’organisation.')).toBeVisible()
  await expect(settings.locator('html')).toHaveAttribute('lang', 'fr')

  await kassa.reload()
  await expect(kassa.getByText('Comptoir — payer directement')).toBeVisible()
  await expect(kassa.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(kassa.getByRole('link', { name: 'Paramètres' })).toBeVisible()
})

test('a French kassa: a cash sale end to end, and the Toog tab is still stored as "Toog"', async ({ kassa, backend }) => {
  await kassa.evaluate(() => localStorage.setItem('arcanum-locale', 'fr'))
  await kassa.reload()

  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect(panel(kassa)).toContainText('5 articles')
  await kassa.getByLabel('Espèces').check()
  await kassa.getByRole('button', { name: /^Encaisser/ }).click()
  await expect(kassa.getByText('En attente du paiement en espèces')).toBeVisible()

  // Back without paying: the Toog sale stays open as a rekening, shown in French.
  await kassa.getByRole('button', { name: 'Retour à l’addition' }).click()
  await expect(panel(kassa).getByRole('heading', { name: '#1 Comptoir' })).toBeVisible()
  expect(backend.tabs[0].label).toBe('Toog')

  await kassa.getByRole('button', { name: /^Encaisser/ }).click()
  await kassa.getByRole('button', { name: 'Confirmer la réception des espèces' }).click()
  await expect(kassa.getByText('Payé (espèces)')).toBeVisible()
  await kassa.getByRole('button', { name: 'Client suivant' }).click()
  await expect(kassa.getByText('Comptoir — payer directement')).toBeVisible()
})

test('the chooser hands the language it was set up in to the device', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-BE' })
  const page = await context.newPage()
  await page.route(/\/api\/organizations\/memberships/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ orgId: 'org-1', orgName: 'Scouts', role: 'admin' }]) })
  )
  await page.route(/\/api\/devices\//, (route) => route.fulfill({ contentType: 'application/json', body: '{}' }))
  // The kassa itself isn't under test here — stop at its URL.
  await page.route(/\/kassa(\.html)?$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>kassa</p>' }))

  await page.goto('/chooser.html')
  await page.getByRole('button', { name: /^Caisse/ }).click()
  await expect(page.getByText('kassa')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('arcanum-locale'))).toBe('fr')
  await context.close()
})
