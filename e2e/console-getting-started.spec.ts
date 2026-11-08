import { expect, test } from './console-fixtures'

// Easy onboarding: a new organisation starts with the example menukaart (on
// by default), and the dashboard's "Aan de slag" leads to a kassa - this
// browser, like the demo, or a device - and a kassalade, until all three
// are there, or it's hidden.

test('the first organisation starts with the example menukaart unless unticked', async ({ console: open, page, orgTransfer }) => {
  orgTransfer.orgs = []
  orgTransfer.capabilities = { orgCreation: 'admins', canCreateOrganization: true, canImportOrganization: true }
  await open('/dashboard')
  const welcome = page.getByTestId('first-organization')
  const option = welcome.getByLabel(/Start met een voorbeeldmenu/)
  await expect(option).toBeChecked()
  await expect(welcome.getByText('Drank, eten en bonnen met prijzen, meteen klaar voor de kassa.', { exact: false })).toBeVisible()
  await welcome.getByLabel('Naam').fill('Scouts Test')
  await welcome.getByRole('button', { name: 'Organisatie aanmaken' }).click()
  await expect(page.getByTestId('first-organization')).toHaveCount(0)
  expect(orgTransfer.created.at(-1)).toEqual({ name: 'Scouts Test', exampleMenu: true, locale: 'nl' })

  // Another one from the switcher, this time without.
  await page.getByRole('button', { name: /Scouts Test/ }).first().click()
  await page.getByRole('menuitem', { name: 'Nieuwe organisatie' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel(/Start met een voorbeeldmenu/)).toBeChecked()
  await dialog.getByLabel(/Start met een voorbeeldmenu/).uncheck()
  await dialog.getByLabel('Naam').fill('Leeg')
  await dialog.getByRole('button', { name: 'Aanmaken' }).click()
  await expect(dialog).toHaveCount(0)
  expect(orgTransfer.created.at(-1)).toEqual({ name: 'Leeg', exampleMenu: false, locale: 'nl' })
})

test('"Aan de slag": the example menukaart, then this browser as the kassa, then the kassalade - and it is gone once all three are there', async ({ console: open, page, catalogAdmin }) => {
  // The kassa tab: only that it opens the pairing page with a fresh code.
  await page.context().route(/\/pair\?/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>pair</title>' }))
  await open('/dashboard')
  const card = page.getByTestId('getting-started')
  await expect(card.getByText('Aan de slag')).toBeVisible()
  await expect(card.getByTestId('getting-started-menu')).toHaveAttribute('data-done', 'false')
  await expect(card.getByTestId('getting-started-register')).toHaveAttribute('data-done', 'false')

  await card.getByRole('button', { name: 'Voorbeeldmenu toevoegen' }).click()
  await expect(card.getByTestId('getting-started-menu')).toHaveAttribute('data-done', 'true')
  await expect(card.getByText('Je hebt producten.')).toBeVisible()
  expect(catalogAdmin.exampleMenu).toBe('nl')

  const [tab] = await Promise.all([page.context().waitForEvent('page'), card.getByRole('button', { name: 'Gebruik deze browser als kassa' }).click()])
  await tab.waitForURL(/\/pair\?/)
  const url = new URL(tab.url())
  expect(url.searchParams.get('role')).toBe('pos')
  expect(url.searchParams.get('name')).toBe('Kassa 1')
  const pairing = catalogAdmin.pairings.at(-1)!
  expect(url.searchParams.get('code')).toBe(pairing.code.replace('-', ''))
  await expect(card.getByText('De kassa staat open in een nieuw tabblad.')).toBeVisible()

  // The new tab claims the code; back in the console, the kassa is done and
  // the kassalade's step still in view.
  catalogAdmin.claimPairing(pairing.code)
  await tab.close()
  await page.bringToFront()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(card.getByTestId('getting-started-kassa')).toHaveAttribute('data-done', 'true')
  await expect(card.getByTestId('getting-started-register')).toHaveAttribute('data-done', 'false')
  await expect(card.getByRole('link', { name: 'Kassalades' })).toBeVisible()

  // A kassalade too: the card has done its job.
  catalogAdmin.registers.push({ id: 'r-1', name: 'Bar', archived: false, open: false })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByTestId('getting-started')).toHaveCount(0)
})

test('"Koppel een iPad of tablet" opens the usual pairing, for a kassa', async ({ console: open, page }) => {
  await open('/dashboard')
  await page.getByTestId('getting-started').getByRole('button', { name: 'Koppel een iPad of tablet' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Toestel toevoegen' })).toBeVisible()
})

test('hidden, it stays hidden for that organisation; done, it never shows', async ({ console: open, page, catalogAdmin }) => {
  await open('/dashboard')
  await page.getByTestId('getting-started').getByRole('button', { name: 'Verbergen' }).click()
  await expect(page.getByTestId('getting-started')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Overzicht' })).toBeVisible()
  await expect(page.getByTestId('getting-started')).toHaveCount(0)

  await page.evaluate(() => localStorage.removeItem('arcanum-admin-getting-started-closed'))
  catalogAdmin.exampleMenu = 'nl'
  catalogAdmin.orgDevices = [{ terminal_id: 't-1', role: 'pos', name: 'Kassa 1' }]
  catalogAdmin.registers.push({ id: 'r-1', name: 'Bar', archived: false, open: false })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Overzicht' })).toBeVisible()
  await expect(page.getByTestId('getting-started')).toHaveCount(0)
})

test('in French too', async ({ console: open, page }) => {
  await page.addInitScript(() => localStorage.setItem('arcanum-admin-locale', 'fr'))
  await open('/dashboard')
  const card = page.getByTestId('getting-started')
  await expect(card.getByText('Pour commencer')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Ajouter le menu d’exemple' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Utiliser ce navigateur comme caisse' })).toBeVisible()
})
