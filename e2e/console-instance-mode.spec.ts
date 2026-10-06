import { expect, test } from './console-fixtures'

// What the installation allows (arcanum-backend's ORG_CREATION): a demo
// instance never offers a new organisation; an own instance only its first;
// and a demo org says when it disappears, with the ways to keep going.

async function openSwitcher(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /E2E/ }).first().click()
}

test('the default: "Nieuwe organisatie" is offered, with import as an alternative', async ({ console: open, page }) => {
  await open('/products')
  await openSwitcher(page)
  await page.getByRole('menuitem', { name: 'Nieuwe organisatie' }).click()
  await expect(page.getByText('of importeer uit een exportbestand')).toBeVisible()
})

test('a demo instance: no new organisation, no import', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.capabilities = { orgCreation: 'internal', canCreateOrganization: false, canImportOrganization: false }
  await open('/products')
  await openSwitcher(page)
  await expect(page.getByRole('menuitem', { name: 'Nieuwe organisatie' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/console/settings/data')
  await expect(page.getByText('Op deze installatie kan je geen organisaties importeren.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Organisatie importeren uit exportbestand' })).toHaveCount(0)
})

test('a demo org shows when it disappears, and how to keep going', async ({ console: open, page, orgTransfer }) => {
  const expiresAt = new Date(Date.now() + 2 * 3600_000)
  orgTransfer.orgs[0].demo = { expiresAt: expiresAt.toISOString(), installUrl: 'https://start.kaboutersoft.be' }
  await open('/products')
  const banner = page.getByTestId('demo-banner')
  const hhmm = expiresAt.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  // After midnight (another day) the banner names the weekday too ("di 01:17").
  await expect(banner).toContainText(new RegExp(`Dit is een demo — ze verdwijnt vanzelf om (\\S+ )?${hhmm}\\.`))
  await expect(banner.getByRole('link', { name: 'Eigen installatie' })).toHaveAttribute('href', 'https://start.kaboutersoft.be')
  await banner.getByRole('link', { name: 'Neem je demo mee' }).click()
  await expect(page).toHaveURL(/\/console\/settings\/data$/)
})

test('an ordinary org has no demo banner', async ({ console: open, page }) => {
  await open('/products')
  await expect(page.getByRole('heading', { level: 1, name: 'Producten' })).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
})

test('a fresh own installation asks for its first organisation, then gets on with it', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.orgs = []
  orgTransfer.capabilities = { orgCreation: 'single', canCreateOrganization: true, canImportOrganization: true }
  await open('/dashboard')
  const welcome = page.getByTestId('first-organization')
  await expect(welcome.getByText('Welkom bij je Arcanum')).toBeVisible()
  await expect(welcome.getByText('of importeer een organisatie uit een exportbestand (bv. je demo)')).toBeVisible()
  await welcome.getByLabel('Naam').fill('Scouts Test')
  await welcome.getByRole('button', { name: 'Organisatie aanmaken' }).click()
  await expect(page.getByTestId('first-organization')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Scouts Test/ }).first()).toBeVisible()
  // Only its first: no more "Nieuwe organisatie".
  await page.getByRole('button', { name: /Scouts Test/ }).first().click()
  await expect(page.getByRole('menuitem', { name: 'Nieuwe organisatie' })).toHaveCount(0)
})

test('without an organisation and without the right to make one: no welcome form', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.orgs = []
  orgTransfer.capabilities = { orgCreation: 'internal', canCreateOrganization: false, canImportOrganization: false }
  await open('/dashboard')
  await expect(page.getByTestId('first-organization')).toHaveCount(0)
})

test('a member of nothing, who may not create an organisation, is told so — not shown an empty console', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.orgs = []
  orgTransfer.capabilities = { orgCreation: 'internal', canCreateOrganization: false, canImportOrganization: false, instanceAdmin: false }
  await open('/dashboard')
  const notice = page.getByTestId('no-membership')
  await expect(notice.getByText('Je bent geen lid van een organisatie')).toBeVisible()
  await expect(notice.getByText('Je bent aangemeld als admin@e2e.test')).toBeVisible()
  await expect(notice.getByText(/Vraag een beheerder van je organisatie om je uit te nodigen/)).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Afmelden en een ander account gebruiken' })).toBeVisible()
  await expect(page.getByTestId('first-organization')).toHaveCount(0)
})

test('someone who may create the first organisation gets that, not the "not a member" notice', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.orgs = []
  orgTransfer.capabilities = { orgCreation: 'admins', canCreateOrganization: true, canImportOrganization: true, instanceAdmin: true }
  await open('/dashboard')
  await expect(page.getByTestId('first-organization')).toBeVisible()
  await expect(page.getByTestId('no-membership')).toHaveCount(0)
})
