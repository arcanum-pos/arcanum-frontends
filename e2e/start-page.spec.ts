// The start page (root `/`, chooser.html): a device is paired only with a
// code from the console; a paired device opens its screen; one removed in
// the console says so and can be paired again. DOMAIN_MODEL.md "Devices:
// control plane and data plane".
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { guardCsp } from './csp-guard'

test.beforeEach(async ({ context }) => {
  guardCsp(context)
})

const KASSA = /\/kassa(\.html)?$/

// Stops at the kassa's URL — the kassa itself isn't under test here.
async function stopAtKassa(page: Page) {
  await page.route(KASSA, (route) => route.fulfill({ contentType: 'text/html', body: '<p>kassa</p>' }))
}

// A kassa's code at /api/public/pair (no sign-in): "sign in first" — then
// the start page claims it with the session.
function kassaNeedsSession(page: Page) {
  return page.route(/\/api\/public\/pair$/, (route) => route.fulfill({ status: 401, json: { error: 'x', code: 'pairing_needs_login', role: 'pos' } }))
}

function storeTerminal(page: Page, terminal: Record<string, unknown>) {
  return page.addInitScript((t) => localStorage.setItem('arcanum-terminal', JSON.stringify(t)), terminal)
}

test('not paired: pair with a code, or go to the console — no role to pick', async ({ page }) => {
  await page.goto('/chooser.html')
  await expect(page.getByRole('heading', { name: 'Wat wil je doen?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dit toestel koppelen' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Naar de console' })).toHaveAttribute('href', '/console')
  await expect(page.getByRole('button', { name: /^Kassa/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Koppelen' })).toBeDisabled()
})

test("the console's QR (or a demo) brings the code: pairs right away, no click, and opens that device", async ({ page }) => {
  const claimed: unknown[] = []
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, async (route) => {
    claimed.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { terminalId: 'pos-9', role: 'pos', orgId: 'org-1', orgName: 'Scouts Kabouterland', orgLocale: 'nl', name: 'Kassa toog' } })
  })
  await kassaNeedsSession(page)
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=K7PM4XQ2')
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([{ code: 'K7PM4XQ2' }])
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-terminal')))!)).toEqual({
    terminalId: 'pos-9',
    role: 'pos',
    orgId: 'org-1',
    orgName: 'Scouts Kabouterland',
    name: 'Kassa toog',
    // The code it was paired with: an app installed from this link opens it every time.
    pairedWith: 'K7PM4XQ2',
  })
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-device')))!).name).toBe('Kassa toog')
})

test('a wrong code: the reason, and nothing stored', async ({ page }) => {
  await page.route(/\/api\/public\/pair$/, (route) =>
    route.fulfill({ status: 400, json: { error: 'x', code: 'pairing_code_invalid' } })
  )
  await page.goto('/chooser.html')
  await page.getByLabel('Koppelcode').fill('ABCD-EFGH')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('alert')).toHaveText('Deze koppelcode klopt niet, is al gebruikt of is verlopen — vraag een beheerder om een nieuwe')
  expect(await page.evaluate(() => localStorage.getItem('arcanum-terminal'))).toBeNull()
})

test('a paired device opens its screen right away', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ json: { terminal_id: 'pos-1', org_id: 'org-1', role: 'pos' } }))
  await stopAtKassa(page)
  await page.goto('/chooser.html')
  await page.waitForURL(KASSA)
})

test('?start: a paired device shows itself instead, with "Openen"', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ json: { terminal_id: 'pos-1', org_id: 'org-1', role: 'pos' } }))
  await stopAtKassa(page)
  await page.goto('/chooser.html?start')
  await expect(page.getByRole('heading', { name: 'Dit toestel is Kassa 1' })).toBeVisible()
  await expect(page.getByText('Organisatie: Scouts')).toBeVisible()
  await page.getByRole('button', { name: 'Openen' }).click()
  await page.waitForURL(KASSA)
})

test('removed in the console: says so, forgets it, and offers pairing again', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ status: 404, json: { error: 'x', code: 'device_not_found' } }))
  await page.goto('/chooser.html')
  await expect(page.getByText('Dit toestel is niet meer gekoppeld (het werd verwijderd in de console).')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dit toestel koppelen' })).toBeVisible()
  // Gone from storage — but the init script puts it back on the next load, so check now.
  expect(await page.evaluate(() => localStorage.getItem('arcanum-terminal'))).toBeNull()
})

// Pairing by link (`?code=`): never replaces a device that still exists unseen.
const claimRoute = async (page: Page, claimed: unknown[]) => {
  await kassaNeedsSession(page)
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, async (route) => {
    claimed.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { terminalId: 'pos-demo', role: 'pos', orgId: 'demo-1', orgName: 'Demo van Bert', orgLocale: 'nl', name: 'Kassa 1' } })
  })
}
const exists = (page: Page) =>
  page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ json: { terminal_id: 'pos-1', org_id: 'org-1', role: 'pos' } }))

test("a link's code on a browser that already is another org's kassa: asks first — keep it, or pair with the new code", async ({ page }) => {
  const claimed: unknown[] = []
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa toog' })
  await exists(page)
  await claimRoute(page, claimed)
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=ABCD-EFGH&org=demo-1')
  const ask = page.getByTestId('replace')
  await expect(ask.getByRole('heading', { name: 'Dit toestel is Kassa toog' })).toBeVisible()
  await expect(ask.getByText('Organisatie: Scouts')).toBeVisible()
  expect(claimed).toEqual([])
  await ask.getByRole('button', { name: 'Koppelen met de nieuwe code' }).click()
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([{ code: 'ABCD-EFGH' }])
})

test('…or keeps the device it is: "Nee, open …" opens it, nothing claimed', async ({ page }) => {
  const claimed: unknown[] = []
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa toog' })
  await exists(page)
  await claimRoute(page, claimed)
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=ABCD-EFGH')
  await page.getByRole('button', { name: 'Nee, open Kassa toog' }).click()
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([])
})

test("a demo's second click: already that demo's kassa — just opens it", async ({ page }) => {
  const claimed: unknown[] = []
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Demo van Bert', name: 'Kassa 1' })
  await exists(page)
  await claimRoute(page, claimed)
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=ABCD-EFGH&org=org-1')
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([])
})

test("an expired demo's kassa left in the browser: pairs with the new code right away", async ({ page }) => {
  const claimed: unknown[] = []
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Demo', name: 'Kassa 1' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ status: 404, json: { error: 'x', code: 'device_not_found' } }))
  await claimRoute(page, claimed)
  await stopAtKassa(page)
  await page.goto('/chooser.html?code=ABCD-EFGH&org=demo-1')
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([{ code: 'ABCD-EFGH' }])
})

test("a link's code that doesn't work: the reason, with the code filled in to try again", async ({ page }) => {
  await page.route(/\/api\/public\/pair$/, (route) => route.fulfill({ status: 400, json: { error: 'x', code: 'pairing_code_invalid' } }))
  await page.goto('/chooser.html?code=ABCD-EFGH')
  await expect(page.getByRole('alert')).toHaveText('Deze koppelcode klopt niet, is al gebruikt of is verlopen — vraag een beheerder om een nieuwe')
  await expect(page.getByLabel('Koppelcode')).toHaveValue('ABCD-EFGH')
})

// /pair (the same page, no sign-in needed — DOMAIN_MODEL.md "Devices",
// 2026-10-12): a station screen or customer display pairs with its code
// alone; a kassa's code asks someone to sign in first, then comes back.
test('/pair: a station screen pairs with its code alone and opens its screen', async ({ page }) => {
  const asked: unknown[] = []
  await page.route(/\/api\/public\/pair$/, async (route) => {
    asked.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { terminalId: 'st-9', role: 'station', orgId: 'org-1', orgName: 'Scouts', orgLocale: 'nl', name: 'Scherm keuken', stationId: 's1' } })
  })
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, (route) => route.fulfill({ status: 500, json: { error: 'never a session claim' } }))
  await page.route(/\/station(\.html)?$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>station</p>' }))
  await page.goto('/pair.html?code=K7PM4XQ2')
  await page.waitForURL(/\/station/)
  expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('arcanum-terminal')))!)).toMatchObject({ terminalId: 'st-9', role: 'station', orgId: 'org-1' })
})

test("/pair: a kassa's code with nobody signed in — sign in first, back to /pair with the code", async ({ page }) => {
  await kassaNeedsSession(page)
  await page.route(/\/api\/organizations\/device-pairings\/claim$/, (route) => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
  await page.goto('/pair.html')
  await page.getByLabel('Koppelcode').fill('k7pm-4xq2')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  const view = page.getByTestId('pair-sign-in')
  await expect(view).toContainText('Meld je aan om deze kassa te koppelen')
  await expect(view.getByRole('link', { name: 'Aanmelden' })).toHaveAttribute('href', `/login?returnTo=${encodeURIComponent('/pair?code=k7pm4xq2')}`)
})

// Install first, then pair (DOMAIN_MODEL.md "Devices", 2026-10-18): the
// console's link carries the device (role, name). Safari gives an app on the
// home screen or in the Dock its own storage — a device paired in the
// browser isn't paired in the app — so there the page asks first.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1'
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const STATION_LINK = '/pair.html?code=K7PM4XQ2&role=station&name=Scherm%20keuken'

async function stationClaim(page: Page, asked: unknown[]) {
  await page.route(/\/api\/public\/pair$/, async (route) => {
    asked.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { terminalId: 'st-9', role: 'station', orgId: 'org-1', orgName: 'Scouts', orgLocale: 'nl', name: 'Scherm keuken' } })
  })
  await page.route(/\/station(\.html)?$/, (route) => route.fulfill({ contentType: 'text/html', body: '<p>station</p>' }))
}

test.describe('the pairing link, in Safari on an iPhone', () => {
  test.use({ userAgent: IPHONE })

  test("is that device (icon, name, manifest); asks first — as an app shows the steps, nothing paired", async ({ page }) => {
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto(STATION_LINK)
    const install = page.getByTestId('install')
    await expect(install.getByRole('heading', { name: 'Scherm keuken' })).toBeVisible()
    await expect(page).toHaveTitle('Scherm keuken')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/station-180.png')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/pair/manifest.webmanifest?role=station&name=Scherm+keuken')
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Scherm keuken')
    await install.getByRole('button', { name: 'Als app (aanbevolen)' }).click()
    const steps = page.getByTestId('install-steps')
    await expect(steps).toHaveAttribute('data-kind', 'ios')
    await expect(steps.locator('li').nth(1)).toHaveText('Kies Zet op beginscherm: de naam Scherm keuken staat al ingevuld.')
    expect(asked).toEqual([])
    // Changed my mind: in this browser after all.
    await install.getByRole('button', { name: 'Toch in deze browser koppelen' }).click()
    await page.waitForURL(/\/station/)
    expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
  })

  test('"In deze browser": pairs right here', async ({ page }) => {
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto(STATION_LINK)
    await page.getByRole('button', { name: 'In deze browser' }).click()
    await page.waitForURL(/\/station/)
    expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
  })

  test('opened as the app (from the home screen): pairs right away', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto(STATION_LINK)
    await page.waitForURL(/\/station/)
    expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
  })

  test('an older link without the device: pairs right away, as before', async ({ page }) => {
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto('/pair.html?code=K7PM4XQ2')
    await page.waitForURL(/\/station/)
  })
})

test.describe('the pairing link, in Safari on a Mac', () => {
  test.use({ userAgent: MAC_SAFARI })
  test('as an app: Add to Dock', async ({ page }) => {
    await stationClaim(page, [])
    await page.goto(STATION_LINK)
    await page.getByRole('button', { name: 'Als app (aanbevolen)' }).click()
    await expect(page.getByTestId('install-steps')).toHaveAttribute('data-kind', 'mac')
    await expect(page.getByTestId('install-steps').locator('li').first()).toHaveText('Kies in de menubalk Archief → Voeg toe aan Dock.')
  })
})

test.describe('the pairing link, in Chrome', () => {
  test.use({ userAgent: CHROME })

  test('pairs right away (its apps share the storage), then the screen offers to install', async ({ page }) => {
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto(STATION_LINK)
    await page.waitForURL(/\/station/)
    expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
    expect(await page.evaluate(() => sessionStorage.getItem('arcanum-offer-install'))).toBe('1')
  })

  test("a kassa's: sign in first, and back to the same link — the device included", async ({ page }) => {
    await kassaNeedsSession(page)
    await page.route(/\/api\/organizations\/device-pairings\/claim$/, (route) => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
    await page.goto('/pair.html?code=K7PM-4XQ2&role=pos&name=Kassa%201')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/kassa-180.png')
    await expect(page.getByTestId('pair-sign-in').getByRole('link', { name: 'Aanmelden' })).toHaveAttribute('href', `/login?returnTo=${encodeURIComponent('/pair?code=K7PM4XQ2&role=pos&name=Kassa+1')}`)
  })

  test('"Open op deze computer" (the admin\'s own browser): not paired unasked — the link to copy, or pair here anyway', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).__copied = []
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => (window as any).__copied.push(text) }, configurable: true })
    })
    const asked: unknown[] = []
    await stationClaim(page, asked)
    await page.goto(`${STATION_LINK}&here`)
    const here = page.getByTestId('pair-here')
    await expect(here).toContainText('dan is deze browser voortaan Scherm keuken')
    await here.getByRole('button', { name: 'Kopieer de link' }).click()
    await expect(here.getByRole('button', { name: 'Gekopieerd' })).toBeVisible()
    expect(await page.evaluate(() => (window as any).__copied)).toEqual([`${new URL(page.url()).origin}/pair?code=K7PM4XQ2&role=station&name=Scherm+keuken`])
    expect(asked).toEqual([])
    await here.getByRole('button', { name: 'Toch hier koppelen' }).click()
    await page.waitForURL(/\/station/)
    expect(asked).toEqual([{ code: 'K7PM4XQ2' }])
  })
})

test('the app opens its pairing link again, days later: the code it was paired with just opens the screen', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1', pairedWith: 'K7PM4XQ2' })
  await exists(page)
  const claimed: unknown[] = []
  await claimRoute(page, claimed)
  await stopAtKassa(page)
  await page.goto('/pair.html?code=k7pm-4xq2&role=pos&name=Kassa%201')
  await page.waitForURL(KASSA)
  expect(claimed).toEqual([])
})

test('…removed in the console since: says so — the used code is not tried again', async ({ page }) => {
  await storeTerminal(page, { terminalId: 'pos-1', role: 'pos', orgId: 'org-1', orgName: 'Scouts', name: 'Kassa 1', pairedWith: 'K7PM4XQ2' })
  await page.route(/\/api\/organizations\/org-1\/devices\/pos-1$/, (route) => route.fulfill({ status: 404, json: { error: 'x', code: 'device_not_found' } }))
  const claimed: unknown[] = []
  await claimRoute(page, claimed)
  await page.goto('/pair.html?code=K7PM4XQ2&role=pos')
  await expect(page.getByText('Dit toestel is niet meer gekoppeld')).toBeVisible()
  expect(claimed).toEqual([])
})
