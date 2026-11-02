import type { Page } from '@playwright/test'
import { expect, panel, test } from './fixtures'

// What the kassa no longer asks the server (REQUEST_BUDGET.md, 0.1.91):
// every call costs Worker requests on the free plan. kassa-load.spec.ts
// replays a whole live day; these pin each rule down on its own.

function counter(kassa: Page) {
  const calls: string[] = []
  kassa.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/')) calls.push(`${req.method()} ${url.pathname}${url.search}`)
  })
  return {
    count: (pattern: RegExp) => calls.filter((c) => pattern.test(c)).length,
    reset: () => calls.splice(0),
  }
}

const VIEW = /PUT .*\/customer-view$/

test('no display on another device: the order goes there once, then no more until the links change', async ({ kassa, backend, push }) => {
  backend.customerViewShown = false
  const calls = counter(kassa)
  await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
  await expect.poll(() => calls.count(VIEW)).toBe(1)
  await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
  await kassa.waitForTimeout(1200)
  expect(calls.count(VIEW)).toBe(1)

  // A display linked to this kassa (devicehub's links_changed): sent again.
  backend.customerViewShown = true
  push({ event: 'links_changed' })
  await kassa.getByRole('button', { name: '15 × Bon', exact: true }).click()
  await expect.poll(() => calls.count(VIEW)).toBe(2)
  await kassa.getByRole('button', { name: '20 × Bon', exact: true }).click()
  await expect.poll(() => calls.count(VIEW)).toBe(3)
})

test('after a payment: the display reset only when a device elsewhere hangs off the kassa', async ({ kassa, backend }) => {
  backend.customerViewShown = false
  const calls = counter(kassa)
  const pay = async () => {
    await kassa.getByRole('button', { name: '5 × Bon', exact: true }).click()
    await expect.poll(() => calls.count(VIEW)).toBeGreaterThan(0)
    await kassa.getByLabel('Contant').check()
    await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
    await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld', exact: true }).click()
    await kassa.getByTestId('payment-next').click()
    await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  }
  await pay()
  expect(calls.count(/POST .*\/reset$/)).toBe(0)

  // A Tap to Pay phone linked (it hears resets): sent again.
  backend.tapPhoneLinked = true
  await kassa.reload()
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  calls.reset()
  await pay()
  expect(calls.count(/POST .*\/reset$/)).toBe(1)
})

test("its own change coming back as a push is not loaded again; another kassa's is", async ({ kassa, backend, push }) => {
  await kassa.getByRole('button', { name: 'Nieuwe rekening', exact: true }).click()
  await kassa.getByLabel('Naam of tafel').fill('Tafel 2')
  await kassa.getByRole('button', { name: 'Rekening openen', exact: true }).click()
  await expect(panel(kassa).getByRole('heading', { name: /Tafel 2/ })).toBeVisible()
  // The list follows from the response: the new tab is in it without asking.
  await expect(kassa.getByRole('button', { name: /^#1 Tafel 2/ })).toBeVisible()
  const calls = counter(kassa)
  const tab = backend.tabByLabel('Tafel 2')!
  push({ event: 'tabs_changed', tab_id: tab.id })
  await kassa.waitForTimeout(600)
  expect(calls.count(/GET .*\/tabs/)).toBe(0)

  const other = backend.openTab('Tafel 9')
  push({ event: 'tabs_changed', tab_id: other.id })
  await expect(kassa.getByRole('button', { name: /^#2 Tafel 9/ })).toBeVisible()
  expect(calls.count(/GET .*\/tabs\?status=open/)).toBe(1)
})

test('coming back to the kassa: nothing again within half a minute; the tabs after; everything after five minutes', async ({ kassa }) => {
  await kassa.clock.install()
  await kassa.reload()
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  const calls = counter(kassa)
  const focus = () => kassa.evaluate(() => window.dispatchEvent(new Event('focus')))
  const catalog = /GET .*\/catalogs\/.*\/kassa/
  const list = /GET .*\/tabs\?status=open/

  await focus()
  await kassa.waitForTimeout(300)
  expect(calls.count(list)).toBe(0)

  await kassa.clock.runFor(31_000)
  await focus()
  await expect.poll(() => calls.count(list)).toBe(1)
  expect(calls.count(catalog)).toBe(0)

  await kassa.clock.runFor(5 * 60_000)
  await focus()
  await expect.poll(() => calls.count(catalog)).toBe(1)
  expect(calls.count(/GET .*\/sumup\/readers/)).toBe(1)
})

test('the live connection comes back after it was down: the tabs are asked again (a push may have been missed)', async ({ kassa, backend, push }) => {
  const calls = counter(kassa)
  backend.openTab('Tafel 7')
  push.drop()
  await expect(kassa.getByRole('button', { name: /^#1 Tafel 7/ })).toBeVisible({ timeout: 5000 })
  expect(calls.count(/GET .*\/tabs\?status=open/)).toBe(1)
})
