import type { Page } from '@playwright/test'
import { expect, panel, test } from './fixtures'
import type { FakeBackend } from './fake-backend'

test.use({ locale: 'en-GB' })

// The kassa and Instellingen speak the device's language (Instellingen →
// Taal), Dutch until one is picked — never the browser's (the specs below
// run in an English browser to prove it).

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

// Pairing a device on the start page (root `/`, chooser.html) with a code
// from the console: the device then speaks a language picked there, else
// the organisation's, else the browser's.
async function pairOnStartPage(browser: import('@playwright/test').Browser, browserLocale: string, orgLocale: string | null, pick?: string) {
  const context = await browser.newContext({ locale: browserLocale })
  const page = await context.newPage()
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, (route) =>
    route.fulfill({ status: 201, json: { terminalId: 'pos-new', role: 'pos', orgId: 'org-1', orgName: 'Scouts', orgLocale, name: 'Kassa 1' } })
  )
  // The kassa itself isn't under test here — stop at its URL.
  await page.route(/\/kassa(\.html)?$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>kassa</p>' }))
  await page.goto('/chooser.html?code=K7PMQ2X4')
  if (pick) await page.getByRole('button', { name: pick }).click()
  await page.getByRole('button', { name: /^(Koppelen|Coupler|Pair)$/ }).click()
  await page.waitForURL(/\/kassa/)
  const stored = await page.evaluate(() => localStorage.getItem('arcanum-locale'))
  await context.close()
  return stored
}

test("pairing a device: a language picked on the start page, else the org's default, else the browser's", async ({ browser }) => {
  expect(await pairOnStartPage(browser, 'nl-BE', 'fr')).toBe('fr')
  expect(await pairOnStartPage(browser, 'nl-BE', 'fr', 'English')).toBe('en')
  expect(await pairOnStartPage(browser, 'fr-BE', null)).toBe('fr')
})

test("a French kassa shows the backend's refusals in French (by error code)", async ({ kassa, backend }) => {
  const tab = backend.openTab('Tafel 2', [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 5 }])
  await kassa.evaluate(() => localStorage.setItem('arcanum-locale', 'fr'))
  await kassa.reload()
  await kassa.getByRole('button', { name: /^#1 Tafel 2/ }).click()
  await expect(panel(kassa).getByText('5 × Bon')).toBeVisible()

  // Another kassa adds a line just before this one charges: a 409 tab_changed.
  backend.beforeNextCharge = () => backend.addLines(tab.id, [{ itemCode: 'bon', name: 'Bon', unitPriceCents: 100, quantity: 1 }])
  await kassa.getByLabel('Espèces').check()
  await kassa.getByRole('button', { name: 'Encaisser € 5,00' }).click()
  await expect(kassa.getByText('L’addition a été modifiée, rechargez et réessayez')).toBeVisible()
  expect(backend.charges).toHaveLength(0)
})
