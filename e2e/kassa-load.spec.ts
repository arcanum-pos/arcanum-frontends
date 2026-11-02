import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

// A live day replayed on the kassa, to count the requests it costs
// (REQUEST_BUDGET.md in the arcanum folder). The scenario is what the
// cashiers did, per bill, read from the database by
// tools/observability/scenario.py: rounds, payment attempts (method, paid
// or not) and the time between bills. The kassa runs as at the Scouts: one
// kassa, its customer display in a second window on the same device, a
// SumUp reader, and a focus event whenever the cashier comes back to the
// kassa window (after the customer used the display, after a payment).
//
// Every call the kassa makes is weighed by the Worker requests it costs on
// Cloudflare (a call through the bff counts at the bff and at the backend,
// and at the devicehub when the backend asks or notifies it), with the hops
// measured on the live days. Each own change also comes back as a
// tabs_changed push, like devicehub does.
//
//   LOAD_BILLS=all npx playwright test kassa-load --project chromium
//
// Fewer bills by default (CI); the budget is per bill either way.

interface Bill {
  gapMs: number
  rounds: number[]
  payments: { method: 'cash' | 'sumup' | 'bancontact'; ok: boolean }[]
}

const SCENARIO = JSON.parse(readFileSync(new URL('./load/2026-11-01.json', import.meta.url), 'utf8')) as { day: string; bills: Bill[] }
const BILLS = process.env.LOAD_BILLS === 'all' ? SCENARIO.bills.length : Number(process.env.LOAD_BILLS || 25)
const LABEL = { cash: 'Contant', sumup: 'SumUp', bancontact: 'Bancontact' } as const
// Requests a provider's callback costs on its own (backend, devicehub
// broadcast, tabs_changed) - the same before and after any kassa change.
const CALLBACK = 3
// Worker requests per bill this replay may cost (REQUEST_BUDGET.md).
const BUDGET_PER_BILL = 40

// Worker requests one kassa call costs.
function cost(method: string, path: string): number {
  if (path === '/whoami') return 1
  if (path.startsWith('/api/devices/ws-token')) return 2 // bff, devicehub
  if (/\/customer-view$/.test(path)) return 3 // bff, backend, devicehub (who is this kassa, what is linked)
  if (/\/devices\/[^/]+\/reset$/.test(path)) return 3 // bff, backend, devicehub
  if (/\/tabs/.test(path) && method !== 'GET') return 3 // bff, backend, devicehub tabs-changed
  if (/\/sumup\/charge$|\/bancontact\/payments$/.test(path)) return 3 // bff, backend, devicehub broadcast
  if (/\/sumup\/confirm$/.test(path)) return 4 // bff, backend, broadcast, tabs-changed
  return 2 // bff, backend
}

test('a live day replayed: Worker requests per bill', async ({ kassa, backend, push, browserName }) => {
  test.skip(browserName !== 'chromium', 'one browser is enough to count')
  test.setTimeout(BILLS * 6_000 + 60_000)
  backend.customerViewShown = false
  // An event chosen and a register with its drawer open, like at the Scouts.
  const event = { id: 'ev-1', name: 'Restaurant', date: SCENARIO.day }
  backend.events = [event]
  backend.shift = { id: 'shift-1', registerId: 'toog', number: 1, status: 'open', openedAt: new Date().toISOString(), openedBy: null, openingFloatCents: 10000, movements: [] }

  // Echo: devicehub tells every kassa of the org, this one too.
  await kassa.route(/\/api\//, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    await route.fallback()
    if (req.method() === 'GET') return
    const tab = path.match(/\/tabs\/([^/]+)/)?.[1]
    const confirmed = /\/sumup\/confirm$/.test(path) ? backend.charges.find((c) => c.id === req.postDataJSON()?.chargeId) : null
    const tabId = tab ?? confirmed?.tabId ?? (/\/tabs$/.test(path) ? backend.tabs.at(-1)?.id : null)
    if (confirmed) setTimeout(() => push({ event: 'payment_updated', payment_id: confirmed.id, method: confirmed.method }), 50)
    if (tabId && (tab || confirmed || /\/tabs$/.test(path))) setTimeout(() => push({ event: 'tabs_changed', tab_id: tabId }), 80)
  })

  await kassa.clock.install()
  await kassa.evaluate((e) => {
    localStorage.setItem('arcanum-sumup-reader', JSON.stringify({ id: 'rdr_1', name: 'Toog' }))
    localStorage.setItem('arcanum-event', JSON.stringify(e))
    localStorage.setItem('arcanum-register', JSON.stringify({ orgId: 'org-e2e', id: 'toog', name: 'Toog' }))
  }, event)
  await kassa.reload()
  await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  await kassa.clock.runFor(2_000)

  const counted: { method: string; path: string }[] = []
  kassa.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/') || url.pathname === '/whoami') counted.push({ method: req.method(), path: url.pathname })
  })
  const focus = () => kassa.evaluate(() => window.dispatchEvent(new Event('focus')))

  let callbacks = 0
  for (const bill of SCENARIO.bills.slice(0, BILLS)) {
    await kassa.clock.runFor(Math.min(bill.gapMs, 15 * 60_000))
    await focus()
    const taps = bill.rounds.reduce((n, r) => n + r, 0)
    for (let i = 0; i < taps; i++) {
      await kassa.getByRole('button', { name: `${5 * ((i % 8) + 1)} × Bon`, exact: true }).click()
      await kassa.clock.runFor(1_500)
    }
    // Up to the first that's paid: a split bill (3 that day) is paid at once
    // here; one that ended without a payment (voided) is paid in cash.
    const paid = bill.payments.findIndex((p) => p.ok)
    const attempts = paid >= 0 ? bill.payments.slice(0, paid + 1) : [...bill.payments, { method: 'cash' as const, ok: true }]
    for (const attempt of attempts) {
      const before = backend.charges.length
      await kassa.getByLabel(LABEL[attempt.method]).check()
      await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
      // The fake clock runs ahead of the network: wait for the charge itself.
      await expect.poll(() => backend.charges.length).toBe(before + 1)
      await kassa.clock.runFor(3_000)
      if (attempt.method === 'cash') {
        if (attempt.ok) await kassa.getByRole('button', { name: 'Bevestig ontvangst contant geld', exact: true }).click()
      } else {
        await kassa.clock.runFor(8_000)
        const charge = backend.charges.at(-1)!
        backend.resolveCharge(charge.id, attempt.ok)
        callbacks++
        push({ event: 'payment_updated', payment_id: charge.id, method: attempt.method })
        if (charge.tabId) push({ event: 'tabs_changed', tab_id: charge.tabId })
      }
      await kassa.clock.runFor(1_000)
      await focus()
      const next = kassa.getByTestId('payment-next')
      const cancel = kassa.getByTestId('payment-cancel')
      if (attempt.ok) {
        await next.click()
      } else {
        await expect(next.or(cancel)).toBeVisible()
        await ((await next.isVisible()) ? next : cancel).click()
      }
      await kassa.clock.runFor(1_000)
    }
    await expect(kassa.getByText('Toog - direct afrekenen')).toBeVisible()
  }
  await kassa.clock.runFor(2_000)

  const workers = counted.reduce((n, c) => n + cost(c.method, c.path), 0) + callbacks * CALLBACK
  const byPath = new Map<string, number>()
  for (const c of counted) {
    const key = `${c.method} ${c.path.replace(/\/(org-e2e|pos-e2e|tab\d+|charge\d+)(?=\/|$)/g, '/:id')}`
    byPath.set(key, (byPath.get(key) ?? 0) + 1)
  }
  const report = {
    day: SCENARIO.day,
    bills: BILLS,
    kassaCallsPerBill: +(counted.length / BILLS).toFixed(1),
    workerRequestsPerBill: +(workers / BILLS).toFixed(1),
    calls: Object.fromEntries([...byPath].sort((a, b) => b[1] - a[1])),
  }
  console.log(JSON.stringify(report, null, 1))
  await test.info().attach('load', { body: JSON.stringify(report, null, 1), contentType: 'application/json' })
  // Before 0.1.91 this day cost ~92 per bill (measured with this replay);
  // ~33 after. A change that brings much of it back fails here.
  expect(report.workerRequestsPerBill).toBeLessThan(BUDGET_PER_BILL)
})
