// A station screen (device role 'station'): the tickets of its one station
// in columns, moved on with a tap; only paid orders by default; delivered
// ones only when asked; live through the notification socket (a push, then
// one fetch — never polling). DOMAIN_MODEL.md "Self-ordering and station screens".
import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'
import { overflowingButtons } from './button-fit'

type Status = 'ordered' | 'in_progress' | 'ready' | 'delivered'
interface FakeTicket {
  id: string
  tabId: string
  status: Status
  createdAt: string
  updatedAt: string
  number: number
  label: string
  paid: boolean
  payLater?: boolean
  mode?: string | null
  claimedBy?: { id: string; name: string; at: string | null } | null
  selfOrder: boolean
  lines: { name: string; quantity: number; voided: number; note: string | null }[]
}

class FakeStation {
  stationId: string | null = 'st-keuken'
  tickets: FakeTicket[] = [
    { ...ticket('t1', 5, true, [{ name: 'Frieten', quantity: 2, voided: 0, note: 'zonder zout' }]), mode: 'Take away' },
    ticket('t2', 6, false, [{ name: 'Croque', quantity: 1, voided: 0, note: null }], true),
    ticket('t3', 4, true, [{ name: 'Soep', quantity: 3, voided: 1, note: null }]),
    // On a tab paid when the guest leaves: made unpaid.
    { ...ticket('t4', 8, false, [{ name: 'Croque', quantity: 2, voided: 0, note: null }], true), payLater: true },
  ]
  listCalls: string[] = []
  moves: { id: string; status: string }[] = []
  // Staff (release B1): names, who has a PIN, and the X-Staff a move came with.
  staff = [
    { id: 'an', name: 'An', hasPin: false },
    { id: 'jan', name: 'Jan', hasPin: true },
  ]
  staffOnMoves: (string | null)[] = []
  claims: { id: string; staffId: string }[] = []
  // Printing (arcanum/PRINTING.md): the org's printers, the print jobs, and
  // what reached the printer on this network (an Epson, ePOS-Print).
  printers: { id: string; name: string; brand: 'epson'; connection: 'push' | 'poll'; host: string | null; port: number | null; deviceId: string; paperMm: number; certFingerprint?: string | null; certUploadedAt?: string | null; stations: { id: string; name: string }[] }[] = []
  jobs: { id: string; printerId: string; kind: string; title: string; status: string; error: string | null; document: string; claimedBy?: string }[] = []
  results: { id: string; success: boolean; code: string }[] = []
  printed: string[] = []
  paperOut = false
  stationPrinter: (string | null)[] = []
  // Trusting a push printer: does this browser reach it, has its
  // certificate been uploaded, the codes and links handed out.
  reachable = true
  certUploaded = false
  trustCodes = 0
  profileLinks = 0
}

const PRINTER = { id: 'pr-1', name: 'Keukenprinter', brand: 'epson' as const, connection: 'push' as const, host: '192.168.1.50', port: 443, deviceId: 'local_printer', paperMm: 80 }

function ticket(id: string, number: number, paid: boolean, lines: FakeTicket['lines'], selfOrder = false): FakeTicket {
  const at = new Date(Date.now() - 4 * 60_000).toISOString()
  return { id, tabId: `tab-${id}`, status: 'ordered', createdAt: at, updatedAt: at, number, label: '', paid, selfOrder, lines }
}

const test = base.extend<{ fake: FakeStation; push: (msg: Record<string, unknown>) => void; station: Page }>({
  context: async ({ context }, provide) => {
    const violations = guardCsp(context)
    await provide(context)
    expect(violations(), 'Content-Security-Policy violations').toEqual([])
  },
  // eslint-disable-next-line no-empty-pattern
  fake: async ({}, provide) => provide(new FakeStation()),
  push: async ({ page }, provide) => {
    const sockets: WebSocketRoute[] = []
    await page.routeWebSocket(/\/devices\/connect/, (ws) => {
      sockets.push(ws)
    })
    await provide((msg) => sockets.forEach((ws) => ws.send(JSON.stringify(msg))))
  },
  station: async ({ page, fake, push }, provide) => {
    void push
    await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1', orgName: 'Scouts Kabouterland', name: 'Scherm keuken' })))
    await page.route(/\/api\//, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      if (url.pathname === '/api/devices/ws-token') return route.fulfill({ json: { token: 'tok' } })
      if (url.pathname === '/api/organizations/org-1/devices/st-1')
        return route.fulfill({ json: { terminal_id: 'st-1', org_id: 'org-1', role: 'station', station_id: fake.stationId, station_name: fake.stationId ? 'Keuken' : null } })
      if (url.pathname === '/api/organizations/org-1/stations/st-keuken/tickets') {
        fake.listCalls.push(url.search)
        const withDelivered = url.searchParams.get('delivered') === '1'
        return route.fulfill({ json: fake.tickets.filter((t) => withDelivered || t.status !== 'delivered') })
      }
      if (url.pathname === '/api/organizations/org-1/staff') return route.fulfill({ json: { required: false, staff: fake.staff } })
      if (url.pathname === '/api/organizations/org-1/printers') return route.fulfill({ json: fake.printers })
      const jobs = url.pathname.match(/^\/api\/organizations\/org-1\/printers\/(.+)\/jobs$/)
      if (jobs) return route.fulfill({ json: fake.jobs.filter((j) => j.printerId === jobs[1] && j.status !== 'printed' && j.status !== 'claimed').map(({ document, ...j }) => (void document, j)) })
      const job = url.pathname.match(/^\/api\/organizations\/org-1\/print-jobs\/(.+)\/(claim|result|retry)$/)
      if (job) {
        const j = fake.jobs.find((x) => x.id === job[1])!
        if (job[2] === 'claim') {
          if (j.status !== 'waiting') return route.fulfill({ status: 409, json: { error: 'x', code: 'print_job_taken' } })
          j.status = 'claimed'
          return route.fulfill({ json: { claim: `c-${j.id}`, document: j.document, printer: { host: PRINTER.host, port: PRINTER.port, deviceId: PRINTER.deviceId } } })
        }
        if (job[2] === 'result') {
          const { success, code } = req.postDataJSON()
          fake.results.push({ id: j.id, success, code })
          j.status = success ? 'printed' : 'failed'
          j.error = success ? null : code
          return route.fulfill({ json: { ok: true } })
        }
        j.status = 'waiting'
        j.error = null
        return route.fulfill({ json: { ok: true } })
      }
      if (url.pathname === '/api/organizations/org-1/printers/pr-1/trust-code') return route.fulfill({ status: 201, json: { code: `code-${++fake.trustCodes}`, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } })
      if (url.pathname === '/api/organizations/org-1/printers/pr-1/profile-link') {
        if (!fake.certUploaded) return route.fulfill({ status: 409, json: { error: 'Voor deze printer is nog geen certificaat opgeladen', code: 'printer_no_certificate' } })
        return route.fulfill({ status: 201, json: { token: `tok-${++fake.profileLinks}`, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } })
      }
      if (url.pathname === '/api/organizations/org-1/stations/st-keuken/printer') {
        const { printerId } = req.postDataJSON()
        fake.stationPrinter.push(printerId)
        for (const p of fake.printers) p.stations = p.id === printerId ? [{ id: 'st-keuken', name: 'Keuken' }] : []
        return route.fulfill({ json: { ok: true } })
      }
      const token = url.pathname.match(/^\/api\/organizations\/org-1\/staff\/(.+)\/token$/)
      if (token) {
        const member = fake.staff.find((x) => x.id === token[1])!
        if (member.hasPin && req.postDataJSON()?.pin !== '2468') return route.fulfill({ status: 403, json: { error: 'x', code: 'staff_pin_wrong' } })
        return route.fulfill({ json: { token: `tok-${member.id}`, staff: { id: member.id, name: member.name } } })
      }
      const claim = url.pathname.match(/^\/api\/organizations\/org-1\/tickets\/(.+)\/claim$/)
      if (claim) {
        const { staffId } = req.postDataJSON()
        fake.claims.push({ id: claim[1], staffId })
        const member = fake.staff.find((x) => x.id === staffId)!
        fake.tickets.find((x) => x.id === claim[1])!.claimedBy = { id: member.id, name: member.name, at: null }
        return route.fulfill({ json: { ok: true } })
      }
      const move = url.pathname.match(/^\/api\/organizations\/org-1\/tickets\/(.+)$/)
      if (move && req.method() === 'POST') {
        const { status } = req.postDataJSON()
        fake.moves.push({ id: move[1], status })
        const staffToken = (await req.headerValue('X-Staff')) ?? null
        fake.staffOnMoves.push(staffToken)
        const t = fake.tickets.find((x) => x.id === move[1])!
        const person = fake.staff.find((x) => `tok-${x.id}` === staffToken)
        if (status === 'in_progress' && !t.claimedBy && person) t.claimedBy = { id: person.id, name: person.name, at: null }
        if (status === 'ordered') t.claimedBy = null
        t.status = status
        return route.fulfill({ json: { id: t.id, status, updatedAt: new Date().toISOString() } })
      }
      return route.fulfill({ status: 404, json: { error: 'not stubbed' } })
    })
    // The printer's own page: answers when this browser trusts it.
    await page.route('https://192.168.1.50/', (route) => (fake.reachable ? route.fulfill({ body: 'Epson' }) : route.abort('failed')))
    await page.goto('/station.html')
    await provide(page)
  },
})

const column = (page: Page, status: Status) => page.getByTestId(`column-${status}`)

test('shows its station; only paid orders by default - saying how many unpaid ones are hidden', async ({ station: page }) => {
  await expect(page.getByTestId('station-name')).toHaveText('Keuken')
  const ordered = column(page, 'ordered')
  await expect(ordered.getByTestId('ticket')).toHaveCount(3)
  // A tab's order shows even with "only paid", marked.
  await expect(ordered.locator('[data-number="8"]')).toContainText('Op rekening')
  await expect(ordered).toContainText('#5')
  await expect(ordered).toContainText('2× Frieten')
  await expect(ordered).toContainText('zonder zout')
  // Its ordering mode, as information (the event has more than one).
  await expect(ordered.locator('[data-number="5"]').getByTestId('ticket-mode')).toHaveText('Take away')
  await expect(ordered.locator('[data-number="4"]').getByTestId('ticket-mode')).toHaveCount(0)
  // A line partly voided at the kassa: what's left, and how many were voided.
  await expect(ordered).toContainText('2× Soep')
  await expect(ordered).toContainText('1 geannuleerd')
  await expect(ordered).not.toContainText('#6')
  await expect(page.getByTestId('hidden-unpaid')).toHaveText('1 onbetaalde bestelling verborgen')
  expect(await overflowingButtons(page), 'button text running over').toEqual([])

  // Unpaid ones too, when asked: marked.
  await page.getByRole('switch', { name: 'Alleen betaald' }).click()
  await expect(ordered.getByTestId('ticket')).toHaveCount(4)
  const unpaid = ordered.locator('[data-number="6"]')
  await expect(unpaid).toContainText('Nog niet betaald')
  await expect(unpaid).toContainText('Zelfbestelling')
})

test('a tap moves a ticket on: start → ready → delivered; delivered ones only when asked', async ({ station: page, fake }) => {
  const five = () => page.locator('[data-testid="ticket"][data-number="5"]')
  await five().getByRole('button', { name: 'Start' }).click()
  await expect(column(page, 'in_progress').locator('[data-number="5"]')).toBeVisible()
  await five().getByRole('button', { name: 'Klaar' }).click()
  await expect(column(page, 'ready').locator('[data-number="5"]')).toBeVisible()
  await five().getByRole('button', { name: 'Afgeleverd' }).click()
  await expect(five()).toHaveCount(0)
  expect(fake.moves).toEqual([
    { id: 't1', status: 'in_progress' },
    { id: 't1', status: 'ready' },
    { id: 't1', status: 'delivered' },
  ])
  await page.getByRole('switch', { name: 'Toon afgeleverd' }).click()
  await expect(column(page, 'delivered').locator('[data-number="5"]')).toBeVisible()
  // …and back, if tapped by mistake.
  await five().getByRole('button', { name: 'Terug' }).click()
  await expect(column(page, 'ready').locator('[data-number="5"]')).toBeVisible()
})

test('live: a push makes it fetch its tickets again - no polling in between', async ({ station: page, fake, push }) => {
  await expect(column(page, 'ordered').getByTestId('ticket')).toHaveCount(3)
  await page.waitForTimeout(1500)
  const before = fake.listCalls.length
  fake.tickets.push(ticket('t9', 9, true, [{ name: 'Spaghetti', quantity: 1, voided: 0, note: null }]))
  push({ event: 'tabs_changed', tab_id: 'tab-t9' })
  await expect(column(page, 'ordered')).toContainText('#9')
  expect(fake.listCalls.length - before).toBe(1)
})

test('a screen without a station says where to choose one', async ({ page, fake }) => {
  fake.stationId = null
  await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-1', role: 'station', orgId: 'org-1' })))
  await page.route(/\/api\//, (route) =>
    route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/devices/st-1') ? { terminal_id: 'st-1', role: 'station', org_id: 'org-1' } : { token: 'x' } })
  )
  await page.routeWebSocket(/\/devices\/connect/, () => {})
  await page.goto('/station.html')
  await expect(page.getByTestId('no-station')).toContainText('Kies er een in de console')
})

test("who's working: chosen in the header (with a PIN), recorded on Start, passed on; only my tickets", async ({ station: page, fake }) => {
  await expect(page.getByTestId('staff-button')).toHaveText('Niemand gekozen')
  await page.getByTestId('staff-button').click()
  const picker = page.getByTestId('staff-picker')
  await picker.getByRole('button', { name: 'Jan' }).click()
  await picker.getByTestId('staff-pin').fill('1111')
  await picker.getByTestId('staff-pin-ok').click()
  await expect(picker).toContainText('Verkeerde pincode')
  await picker.getByTestId('staff-pin').fill('2468')
  await picker.getByTestId('staff-pin-ok').click()
  await expect(picker).toBeHidden()
  await expect(page.getByTestId('staff-button')).toHaveText('Jan')

  const five = () => page.locator('[data-testid="ticket"][data-number="5"]')
  await five().getByRole('button', { name: 'Start' }).click()
  await expect(five().getByTestId('ticket-claimed')).toHaveText('Jan maakt dit')
  expect(fake.staffOnMoves).toEqual(['tok-jan'])

  // Passed on to An.
  await five().getByTestId('pass-on-button').click()
  await page.getByTestId('pass-on').getByRole('button', { name: 'An' }).click()
  await expect(five().getByTestId('ticket-claimed')).toHaveText('An maakt dit')
  expect(fake.claims).toEqual([{ id: 't1', staffId: 'an' }])

  // Only my tickets: An's is hidden for Jan; new ones stay.
  await page.getByRole('switch', { name: 'Alleen mijn bonnen' }).click()
  await expect(five()).toHaveCount(0)
  await expect(column(page, 'ordered').getByTestId('ticket')).toHaveCount(2)
  await page.getByRole('switch', { name: 'Alleen mijn bonnen' }).click()

  // Given back: in the queue again, nobody's.
  await five().getByRole('button', { name: 'Terug' }).click()
  await expect(column(page, 'ordered').locator('[data-number="5"]')).toBeVisible()
  await expect(five().getByTestId('ticket-claimed')).toHaveCount(0)

  // The person stays chosen after a reload (S1).
  await page.reload()
  await expect(page.getByTestId('staff-button')).toHaveText('Jan')
})

// Just paired in Chrome, Edge or Android (their apps share the browser's
// storage, shared/install): the screen offers to install itself, once.
test('just paired: "Installeer als app" when the browser can install it - once', async ({ station: page }) => {
  const offer = () =>
    page.evaluate(() => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => void ((window as any).__prompted = true) })
      window.dispatchEvent(event)
    })
  // Not just paired: nothing.
  await offer()
  await expect(page.getByTestId('install-prompt')).toHaveCount(0)
  await page.evaluate(() => sessionStorage.setItem('arcanum-offer-install', '1'))
  await page.reload()
  await expect(page.getByTestId('column-ordered')).toBeVisible()
  await offer()
  const prompt = page.getByTestId('install-prompt')
  await expect(prompt).toContainText('Installeer als app')
  await prompt.getByRole('button', { name: 'Installeren' }).click()
  await expect(prompt).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__prompted)).toBe(true)
  // Asked once: not again.
  await page.reload()
  await expect(page.getByTestId('column-ordered')).toBeVisible()
  await offer()
  await expect(page.getByTestId('install-prompt')).toHaveCount(0)
})

// Its organisation's own icon (Weergave → App-iconen), for the tab and for
// installing from here: the prep station's — arcanum-bff serves it, or the default.
test("the station's own icon, once it knows its station", async ({ station: page }) => {
  await expect(page.getByTestId('column-ordered')).toBeVisible()
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/org/org-1/station-st-keuken-180.png')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/icons/org/org-1/station-st-keuken-96.png')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/icons/org/org-1/station-st-keuken.webmanifest?name=Keuken')
})

// --- Printing (arcanum/PRINTING.md) ---

// The printer on this network: an Epson answering ePOS-Print.
async function epson(page: Page, fake: FakeStation) {
  await page.route('https://192.168.1.50/cgi-bin/epos/service.cgi**', async (route) => {
    const body = route.request().postData() ?? ''
    if (!fake.paperOut) fake.printed.push(body)
    const response = fake.paperOut ? 'success="false" code="EPTR_REC_EMPTY" status="252641308"' : 'success="true" code="" status="251658262"'
    return route.fulfill({
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" ${response} battery="0"/></s:Body></s:Envelope>`,
    })
  })
}

const printJob = (id: string, title: string) => ({ id, printerId: 'pr-1', kind: 'ticket', title, status: 'waiting', error: null, document: `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text>${title}&#10;</text><cut/></epos-print>` })

test("prints its station's tickets: what waits when it opens, then each one it's told about", async ({ station: page, fake, push }) => {
  fake.printers = [{ ...PRINTER, stations: [{ id: 'st-keuken', name: 'Keuken' }] }]
  fake.jobs = [printJob('j1', 'Keuken #5')]
  await epson(page, fake)
  await page.reload()
  await expect(page.getByTestId('printer-button')).toContainText('Keukenprinter')
  await expect.poll(() => fake.results).toEqual([{ id: 'j1', success: true, code: '' }])
  expect(fake.printed[0]).toContain('<s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text>Keuken #5&#10;</text><cut/></epos-print></s:Body>')

  fake.jobs.push(printJob('j2', 'Keuken #6'))
  push({ event: 'print_job', printer_id: 'pr-1' })
  await expect.poll(() => fake.results.map((r) => r.id)).toEqual(['j1', 'j2'])
  // Another printer's job: not this screen's.
  fake.jobs.push({ ...printJob('j3', 'Bar #7'), printerId: 'pr-2' })
  push({ event: 'print_job', printer_id: 'pr-2' })
  await page.waitForTimeout(300)
  expect(fake.results).toHaveLength(2)
  await expect(page.getByTestId('printer-button')).toHaveAttribute('data-state', 'idle')
})

test('paper out: says so, holds the rest, and prints it again when asked', async ({ station: page, fake }) => {
  fake.printers = [{ ...PRINTER, stations: [{ id: 'st-keuken', name: 'Keuken' }] }]
  fake.jobs = [printJob('j1', 'Keuken #5'), printJob('j2', 'Keuken #6')]
  fake.paperOut = true
  await epson(page, fake)
  await page.reload()
  await expect(page.getByTestId('printer-button')).toHaveAttribute('data-state', 'problem')
  await expect(page.getByTestId('printer-button')).toContainText('1 niet geprint')
  // The first failed; the second waits until it's sorted.
  expect(fake.results).toEqual([{ id: 'j1', success: false, code: 'EPTR_REC_EMPTY' }])

  await page.getByTestId('printer-button').click()
  await expect(page.getByTestId('printer-problem')).toHaveText('Het papier is op')
  fake.paperOut = false
  await page.getByTestId('printer-failed').getByRole('button', { name: 'Opnieuw' }).click()
  await expect.poll(() => fake.results.filter((r) => r.success).map((r) => r.id)).toEqual(['j1', 'j2'])
  await expect(page.getByTestId('printer-failed')).toHaveCount(0)
})

test('chooses its printer on the screen itself', async ({ station: page, fake }) => {
  fake.printers = [{ ...PRINTER, stations: [] }]
  await page.reload()
  await expect(page.getByTestId('printer-button')).toContainText('Geen printer')
  await page.getByTestId('printer-button').click()
  await page.getByRole('combobox', { name: 'Printer' }).click()
  await page.getByRole('option', { name: 'Keukenprinter' }).click()
  await expect.poll(() => fake.stationPrinter).toEqual(['pr-1'])
  await expect(page.getByTestId('printer-button')).toContainText('Keukenprinter')
  await expect(page.getByRole('link', { name: 'Printer openen' })).toHaveAttribute('href', 'https://192.168.1.50/')
})

test('a printer that fetches its own work: the screen sends nothing, but shows what failed', async ({ station: page, fake }) => {
  fake.printers = [{ ...PRINTER, connection: 'poll', host: null, port: null, stations: [{ id: 'st-keuken', name: 'Keuken' }] }]
  fake.jobs = [printJob('j1', 'Keuken #5'), { ...printJob('j2', 'Keuken #4'), status: 'failed', error: 'EPTR_COVER_OPEN' }]
  await epson(page, fake)
  await page.reload()
  await expect(page.getByTestId('printer-button')).toContainText('1 niet geprint')
  await page.getByTestId('printer-button').click()
  await expect(page.getByRole('dialog')).toContainText('haalt zijn bonnen zelf op')
  await expect(page.getByRole('link', { name: 'Printer openen' })).toHaveCount(0)
  await expect(page.getByTestId('printer-failed')).toContainText('De klep staat open')
  expect(fake.results).toEqual([])
  expect(fake.printed).toEqual([])
})

test("a printer this screen can't reach: the command for a computer, the profile for an iPad", async ({ station: page, fake }) => {
  fake.printers = [{ ...PRINTER, stations: [{ id: 'st-keuken', name: 'Keuken' }] }]
  fake.reachable = false
  await page.reload()
  await page.getByTestId('printer-button').click()
  const trust = page.getByTestId('printer-trust')
  await expect(trust).toHaveAttribute('data-reach', 'no')
  await expect(trust).toContainText('Dit toestel bereikt de printer niet')

  // A Mac: one command that uploads the certificate, then trusts it.
  await trust.getByRole('combobox', { name: 'Toestel' }).click()
  await page.getByRole('option', { name: 'Mac' }).click()
  await trust.getByRole('button', { name: 'Toon het commando' }).click()
  const command = trust.getByTestId('trust-command')
  await expect(command).toContainText("openssl s_client -connect '192.168.1.50:443'")
  await expect(command).toContainText(`/api/public/print/cert/pr-1?code=code-1`)
  await expect(command).toContainText('security add-trusted-cert')
  await expect(trust).toContainText('Open Terminal')
  // Windows: PowerShell instead, with a new code.
  await trust.getByRole('combobox', { name: 'Toestel' }).click()
  await page.getByRole('option', { name: 'Windows' }).click()
  await trust.getByRole('button', { name: 'Toon het commando' }).click()
  await expect(command).toContainText('Import-Certificate')
  await expect(command).toContainText('code=code-2')

  // An iPad: no certificate uploaded yet - says to do that from a computer first.
  await trust.getByRole('combobox', { name: 'Toestel' }).click()
  await page.getByRole('option', { name: 'iPad of iPhone' }).click()
  await expect(trust).toContainText('nog niet opgeladen')
  fake.certUploaded = true
  await trust.getByRole('button', { name: 'Opnieuw proberen' }).click()
  const profile = trust.getByTestId('profile-link')
  await expect(profile).toHaveText('Download profiel')
  await expect(profile).toHaveAttribute('href', /\/api\/public\/print\/profile\/pr-1\?token=tok-1$/)
  await expect(profile).toHaveAttribute('target', '_blank')
  await expect(trust).toContainText('Instellingen voor certificaatvertrouwen')

  // Trusted now: checked again, it reaches the printer.
  fake.reachable = true
  await trust.getByRole('button', { name: 'Opnieuw controleren' }).click()
  await expect(trust).toHaveAttribute('data-reach', 'ok')
  await expect(trust).toContainText('Dit toestel bereikt de printer.')
})

test('a printer it reaches: says so; trusting it stays one tap away, with the uploaded certificate', async ({ station: page, fake }) => {
  fake.printers = [{ ...PRINTER, certFingerprint: 'ab'.repeat(32), certUploadedAt: '2026-10-29T08:00:00.000Z', stations: [{ id: 'st-keuken', name: 'Keuken' }] }]
  await page.reload()
  await page.getByTestId('printer-button').click()
  const trust = page.getByTestId('printer-trust')
  await expect(trust).toHaveAttribute('data-reach', 'ok')
  await expect(trust.getByTestId('trust-command')).toHaveCount(0)
  await trust.getByRole('button', { name: 'Printer vertrouwen op dit toestel' }).click()
  await expect(trust.getByTestId('printer-cert')).toContainText('AB:AB:AB')
})
