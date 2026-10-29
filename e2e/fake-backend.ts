// In-memory stand-in for the parts of arcanum-backend the kassa talks to
// (tabs API, catalogs' kassa view + list, charge endpoints), so the E2E suite runs with no Worker, no
// D1 and no login. It mirrors the rules arcanum-backend/src/tabs.ts
// enforces — amount must equal outstanding + tip (the tip is charged but
// never counts as paid), one pending charge per tab, closed tabs refuse
// orders, cancel only when empty, every line priced by the server from a
// visible entry of a non-archived catalog (free lines refused) — with the same
// status codes and Dutch error messages, so the UI's error handling is
// exercised. It is NOT a test of those rules: arcanum-backend's own suite
// covers the real implementation. Keep the two in step when the API
// changes.

export interface FakeLineInput {
  itemCode?: string | null
  // The catalog variant it was sold as (the kassa's menu counts per variant).
  variantId?: string | null
  name: string
  unitPriceCents: number
  quantity: number
  // The product's category at sale time (the customer display counts per category).
  category?: string | null
}

// A line as the kassa sends it: variantId + quantity (any name/price is
// ignored). Anything else is a free line, which the backend refuses since 3d.
type OrderLineInput = FakeLineInput | { variantId: string; quantity: number }

export const FREE_LINE_REFUSAL = 'Elke lijn moet van de menukaart komen'

export interface FakeEntry {
  entryId: string
  variantId: string
  name: string
  priceCents: number
  code: string | null
  categoryName: string | null
  quickQuantities: number[] | null
  visible: boolean
}

export interface FakeCatalog {
  id: string
  name: string
  isDefault: boolean
  archived: boolean
  sections: { id: string; name: string; color?: string | null; entries: FakeEntry[] }[]
}

export function fakeEntry(variantId: string, name: string, priceCents: number, code: string | null, quickQuantities: number[] | null = null): FakeEntry {
  return { entryId: `e-${variantId}`, variantId, name, priceCents, code, categoryName: null, quickQuantities, visible: true }
}

// Same items and prices as the Scouts Elewijt seed (migration 0013).
function standardCatalog(): FakeCatalog {
  return {
    id: 'cat-standaard',
    name: 'Standaard',
    isDefault: true,
    archived: false,
    sections: [
      { id: 's-bonnen', name: 'Bonnen', entries: [fakeEntry('v-bon', 'Bon', 100, 'bon', [5, 10, 15, 20, 25, 30, 35, 40])] },
      {
        id: 's-tochten',
        name: 'Tochten',
        entries: [
          fakeEntry('v-fiets', 'Fietstocht (niet-lid)', 800, 'fietstocht'),
          fakeEntry('v-fiets-lid', 'Fietstocht (lid)', 500, 'fietstochtMember'),
          fakeEntry('v-wandel', 'Wandeltocht (niet-lid)', 600, 'wandeltocht'),
          fakeEntry('v-wandel-lid', 'Wandeltocht (lid)', 300, 'wandeltochtMember'),
        ],
      },
    ],
  }
}

const MENUKAART_REFUSAL = 'Dit product staat niet (meer) op de menukaart - herlaad de kassa'
const UNKNOWN_CATALOG = 'Onbekende of gearchiveerde menukaart'
// arcanum-backend's error codes (src/errors.ts) for the refusals above.
const REFUSAL_CODES: Record<string, string> = { [MENUKAART_REFUSAL]: 'product_not_on_catalog', [UNKNOWN_CATALOG]: 'unknown_catalog' }

interface Line {
  id: string
  orderId: string
  itemCode: string | null
  category?: string | null
  variantId: string | null
  name: string
  unitPriceCents: number
  quantity: number
  voidsLineId: string | null
  voidReason: string | null
  createdAt: string
}

interface Tab {
  id: string
  number: number
  label: string
  status: 'open' | 'closed' | 'cancelled'
  openedDeviceName: string | null
  openedAt: string
  closedAt?: string | null
  cancelReason?: string | null
  receiptNumber: number | null
  eventId?: string | null
  // Self-ordering (DOMAIN_MODEL.md): the event's short number, where it came
  // from, and — with something to prepare — where the customer follows it.
  eventNumber?: number | null
  source?: string
  followUrl?: string | null
  // Its ordering mode (like tabs.order_mode_id), and the name the backend
  // shows when the event has more than one.
  orderModeId?: string | null
  orderMode?: string | null
  // A guest's tab: how to reach them (the backend sends it with the detail).
  contact?: { phone: string | null; email: string | null } | null
  // "Gelijk verdelen" plan, like the backend's tabs.split_parts / split_paid.
  splitParts?: number | null
  splitPaid?: number
}

export interface FakeEvent {
  id: string
  name: string
  date: string
  kassaModes?: boolean
  modes?: { id: string; name: string }[]
}

export interface FakeCharge {
  id: string
  tabId: string | null
  method: string
  status: 'pending' | 'succeeded' | 'failed'
  amountCents: number
  tipCents: number
  // Which part of an equal split (1-based), 0 = not a part.
  splitPart?: number
  // Per item: the units this payment covers.
  lines?: { lineId: string; quantity: number }[]
  // Every charge body as the kassa sent it, for assertions.
  body?: any
}

export interface FakeResponse {
  status: number
  body: unknown
}

let seq = 0
const nextId = (prefix: string) => `${prefix}${++seq}`

export class FakeBackend {
  tabs: Tab[] = []
  lines: Line[] = []
  charges: FakeCharge[] = []
  // SumUp Tap to Pay set up for the org (the readers list says so); and
  // whether SumUp has it paid when the kassa cancels (it asks first).
  tapToPay = false
  tapPaidAtSumup = false
  // SumUp can't list the readers right now (the answer still says whether Tap to Pay is set up).
  readersFail = false
  catalogs: FakeCatalog[] = [standardCatalog()]
  events: FakeEvent[] = []
  private tabCounter = 0
  private receiptCounter = 0
  // Runs right before the next charge is validated — simulates another
  // kassa changing the tab in the window between this kassa reading it and
  // paying it.
  beforeNextCharge: (() => void) | null = null

  // --- Test helpers (state set up "from another kassa") ---

  openTab(label: string, lines: FakeLineInput[] = []): Tab {
    const tab: Tab = {
      id: nextId('tab'),
      number: ++this.tabCounter,
      label,
      status: 'open',
      openedDeviceName: 'Andere kassa',
      openedAt: new Date().toISOString(),
      receiptNumber: null,
    }
    this.tabs.push(tab)
    if (lines.length) this.addLines(tab.id, lines)
    return tab
  }

  addLines(tabId: string, lines: FakeLineInput[]) {
    this.addOrder(tabId, lines)
  }

  startCharge(tabId: string, method = 'cash'): FakeCharge {
    const charge: FakeCharge = { id: nextId('charge'), tabId, method, status: 'pending', amountCents: this.summary(this.tab(tabId)!).outstandingCents, tipCents: 0 }
    this.charges.push(charge)
    return charge
  }

  resolveCharge(chargeId: string, success: boolean) {
    const charge = this.charges.find((c) => c.id === chargeId)
    if (!charge || charge.status !== 'pending') return
    charge.status = success ? 'succeeded' : 'failed'
    if (success && charge.tabId && charge.splitPart) {
      const tab = this.tab(charge.tabId)!
      if (tab.splitParts) tab.splitPaid = (tab.splitPaid || 0) + 1
    }
    if (success && charge.tabId) this.settle(charge.tabId)
  }

  tabByLabel(label: string): Tab | undefined {
    return this.tabs.find((t) => t.label === label)
  }

  addCatalog(id: string, name: string, sections: FakeCatalog['sections']): FakeCatalog {
    const catalog: FakeCatalog = { id, name, isDefault: false, archived: false, sections }
    this.catalogs.push(catalog)
    return catalog
  }

  entry(variantId: string, catalogId = 'cat-standaard'): FakeEntry | undefined {
    return this.catalogs.find((c) => c.id === catalogId)?.sections.flatMap((s) => s.entries).find((e) => e.variantId === variantId)
  }

  removeEntry(variantId: string, catalogId = 'cat-standaard') {
    for (const section of this.catalogs.find((c) => c.id === catalogId)?.sections || []) {
      section.entries = section.entries.filter((e) => e.variantId !== variantId)
    }
  }


  // --- Internals ---

  private tab(id: string) {
    return this.tabs.find((t) => t.id === id)
  }

  tabLines(tabId: string) {
    return this.lines.filter((l) => this.lineTab.get(l.orderId) === tabId)
  }

  // orderId -> tabId, so lines don't need their own tabId field.
  lineTab = new Map<string, string>()

  private summary(tab: Tab) {
    const lines = this.tabLines(tab.id)
    const totalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)
    const charges = this.charges.filter((c) => c.tabId === tab.id)
    // The tip is part of what the customer paid, but never of the tab.
    const paidCents = charges.filter((c) => c.status === 'succeeded').reduce((s, c) => s + c.amountCents - c.tipCents, 0)
    const outstandingCents = totalCents - paidCents
    const left = tab.splitParts ? Math.max(1, tab.splitParts - (tab.splitPaid || 0)) : 0
    return {
      ...tab,
      split: tab.splitParts ? { parts: tab.splitParts, paid: tab.splitPaid || 0, nextCents: left === 1 ? outstandingCents : Math.floor(outstandingCents / left) } : null,
      eventId: tab.eventId ?? null,
      eventName: this.events.find((e) => e.id === tab.eventId)?.name ?? null,
      totalCents,
      paidCents,
      outstandingCents: totalCents - paidCents,
      paymentPending: charges.some((c) => c.status === 'pending'),
      closedAt: tab.closedAt ?? null,
      cancelReason: tab.cancelReason ?? null,
      // Like the backend: distinct methods of succeeded charges, first paid first.
      methods: [...new Set(charges.filter((c) => c.status === 'succeeded').map((c) => c.method))],
      // Net units still on the tab (voids are negative lines here).
      itemCount: lines.filter((l) => l.itemCode !== 'fooi').reduce((n, l) => n + l.quantity, 0),
    }
  }

  // Units of a line covered by succeeded item payments.
  paidUnits(lineId: string): number {
    return this.charges.filter((c) => c.status === 'succeeded').reduce((sum, c) => sum + (c.lines?.find((l) => l.lineId === lineId)?.quantity || 0), 0)
  }

  private detail(tab: Tab) {
    const lines = this.tabLines(tab.id)
    return {
      ...this.summary(tab),
      lines: lines.map((l) => ({
        ...l,
        voidedQuantity: -lines.filter((v) => v.voidsLineId === l.id).reduce((s, v) => s + v.quantity, 0),
        paidQuantity: this.paidUnits(l.id),
      })),
      payments: this.charges
        .filter((c) => c.tabId === tab.id)
        .map((c) => ({ id: c.id, method: c.method, status: c.status, amountCents: c.amountCents, tipCents: c.tipCents, deviceName: 'Andere kassa', userName: null, createdAt: tab.openedAt, resolvedAt: c.status === 'pending' ? null : tab.closedAt ?? null })),
    }
  }

  private settle(tabId: string) {
    const tab = this.tab(tabId)!
    const s = this.summary(tab)
    if (tab.status === 'open' && s.paidCents >= s.totalCents) {
      tab.status = 'closed'
      tab.closedAt = new Date().toISOString()
      tab.receiptNumber = ++this.receiptCounter
    }
  }

  private refusal(tabId: string): FakeResponse {
    const tab = this.tab(tabId)
    if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden', code: 'tab_not_found' } }
    const s = this.summary(tab)
    if (tab.status !== 'open') return { status: 409, body: { error: 'Rekening is niet meer open', code: 'tab_not_open', tab: s } }
    if (s.paymentPending) return { status: 409, body: { error: 'Er loopt een betaling voor deze rekening', code: 'tab_payment_pending', tab: s } }
    return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', code: 'tab_changed', tab: s } }
  }

  private writable(tabId: string) {
    const tab = this.tab(tabId)
    return !!tab && tab.status === 'open' && !this.summary(tab).paymentPending
  }

  // --- Devices (arcanum-backend devices.ts) ---
  // The registry, as the backend answers it for org-e2e. The kassa fixture's
  // own terminal is in it; remove it to play "removed in the console".
  // The customer display's branding: the org's, and per event its own colours.
  branding: { primary: string | null; accent: string | null; logoUrl: string | null } = { primary: null, accent: null, logoUrl: null }
  eventBranding = new Map<string, { primary: string | null; accent: string | null }>()
  brandingRequests: { orgId: string; eventId: string | null }[] = []
  // Receipts (arcanum-backend printing.ts): on for the org?, its printers, the receipts asked for.
  receiptsEnabled = false
  printers: any[] = []
  receipts: { printerId: string; tabId: string; chargeId?: string; chargeStatus?: string }[] = []
  // A cancelled Bancontact payment: the provider can't be reached.
  cancelUnreachable = false
  devices = new Map<string, { terminal_id: string; org_id: string; role: string; linked_to: string | null; name: string | null }>([
    ['pos-e2e', { terminal_id: 'pos-e2e', org_id: 'org-e2e', role: 'pos', linked_to: null, name: 'Kassa 1' }],
  ])
  // Pairing codes a test made "in the console": code (as shown) → role + name.
  // "Ticket annuleren" requests (cancel with voidAll).
  cancelAllRequests: { tabId: string; reason: string }[] = []
  // The order being entered: what kassa's sent (PUT), what a display gets (GET).
  customerViewPuts: { terminal: string; order: any; seq: number }[] = []
  customerView: { order: any; seq: number } = { order: null, seq: 0 }
  pairingCodes = new Map<string, { role: 'pos' | 'cfd'; name: string }>()
  // The signed-in person's role in org-e2e (Instellingen's Beheer is for admins).
  memberRole: 'admin' | 'cashier' | 'waiter' = 'cashier'
  // Staff (release B1): the organisation's people, whether one must be
  // chosen, the X-Staff the current request came with (set by the fixture),
  // and the person each new tab and payment was recorded with.
  staff = [{ id: 'an', name: 'An', hasPin: false }]
  staffRequired = false
  currentStaff: string | null = null
  recordedStaff: { what: 'tab' | 'charge'; staff: string | null }[] = []
  // Registers and shifts (release B2): one drawer, its shift, what was sold on it.
  registers = [{ id: 'toog', name: 'Toog', archived: false, open: false }]
  blindCount = false
  shift: any = null
  shiftNumber = 0
  lastLeftInDrawer: number | null = null
  registerIdsSent: (string | null)[] = []
  shiftCash = 0
  // The shift's payments per method, when a scene wants more than the cash taken (screenshots).
  shiftMethods: Record<string, { count: number; cents: number; tipCents: number }> | null = null
  // Who worked on the open shift (the backend works it out from the payments).
  shiftPeople: { name: string; payments: number }[] = []
  private shiftJson() {
    const s = this.shift
    if (!s) return null
    const expected = s.openingFloatCents + this.shiftCash + s.movements.reduce((n: number, m: any) => n + (m.direction === 'in' ? m.amountCents : -m.amountCents), 0)
    return { ...s, totals: { methods: this.shiftMethods ?? (this.shiftCash ? { cash: { count: 1, cents: this.shiftCash, tipCents: 0 } } : {}), cashIn: 0, cashOut: 0 }, expectedCents: this.blindCount ? null : expected, pendingPayments: 0, openTabs: this.tabs.filter((t) => t.status === 'open').length, people: this.shiftPeople, _expected: expected }
  }
  private registerRoute(method: string, p: string, body: any): FakeResponse | null {
    if (/^\/api\/organizations\/[^/]+\/registers$/.test(p) && method === 'GET') return { status: 200, body: { blindCount: this.blindCount, registers: this.registers } }
    const reg = p.match(/^\/api\/organizations\/[^/]+\/registers\/([^/]+)\/shift$/)
    if (reg && method === 'GET') {
      const r = this.registers.find((x) => x.id === reg[1])
      if (!r) return { status: 404, body: { error: 'x', code: 'register_not_found' } }
      const { _expected, ...shift } = this.shiftJson() ?? ({} as any)
      return { status: 200, body: { register: r, shift: this.shift ? shift : null, suggestedFloatCents: this.lastLeftInDrawer, blindCount: this.blindCount } }
    }
    if (reg && method === 'POST') {
      if (this.shift) return { status: 409, body: { error: 'x', code: 'shift_already_open' } }
      const float = body.count ? Object.entries(body.count).reduce((n: number, [d, c]: any) => n + Number(d) * c, 0) : body.floatCents
      this.shift = { id: `shift-${++this.shiftNumber}`, registerId: reg[1], number: this.shiftNumber, status: 'open', openedAt: new Date().toISOString(), openedBy: null, openingFloatCents: float, movements: [] }
      this.shiftCash = 0
      return { status: 201, body: this.shiftJson() }
    }
    const mv = p.match(/^\/api\/organizations\/[^/]+\/shifts\/([^/]+)\/movements$/)
    if (mv && method === 'POST') {
      this.shift.movements.push({ direction: body.direction, amountCents: body.amountCents, reason: body.reason, by: null, at: new Date().toISOString() })
      return { status: 201, body: this.shiftJson() }
    }
    const close = p.match(/^\/api\/organizations\/[^/]+\/shifts\/([^/]+)\/close$/)
    if (close && method === 'POST') {
      const expected = this.shiftJson()!._expected
      const counted = Object.entries(body.count ?? {}).reduce((n: number, [d, c]: any) => n + Number(d) * c, 0)
      if (!this.blindCount && Math.abs(counted - expected) >= 100 && !body.note) return { status: 400, body: { error: 'x', code: 'shift_note_required' } }
      const done = { ...this.shift, status: 'closed', countedCents: counted, expectedCents: expected, differenceCents: counted - expected, leftInDrawerCents: body.leftInDrawerCents, note: body.note ?? null }
      this.closedShifts.push(done)
      this.lastLeftInDrawer = body.leftInDrawerCents
      this.shift = null
      return { status: 200, body: done }
    }
    return null
  }
  closedShifts: any[] = []
  // Set: org-e2e is a demo that disappears then (the kassa's demo bar).
  demoExpiresAt: string | null = null
  deviceCalls: { method: string; id: string; action?: string; body?: any }[] = []

  private claim(code: string): FakeResponse {
    const key = code.toUpperCase().replace(/[\s-]/g, '')
    const entry = [...this.pairingCodes].find(([c]) => c.replace('-', '') === key)
    if (!entry) return { status: 400, body: { error: 'Deze koppelcode klopt niet, is al gebruikt of is verlopen - vraag een beheerder om een nieuwe', code: 'pairing_code_invalid' } }
    this.pairingCodes.delete(entry[0])
    const terminalId = nextId('dev-')
    this.devices.set(terminalId, { terminal_id: terminalId, org_id: 'org-e2e', role: entry[1].role, linked_to: null, name: entry[1].name })
    return { status: 201, body: { terminalId, role: entry[1].role, orgId: 'org-e2e', orgName: 'E2E', orgLocale: this.orgLocale, name: entry[1].name } }
  }
  orgLocale: string | null = null

  private handleDevice(method: string, id: string, action: string | undefined, body: any): FakeResponse {
    this.deviceCalls.push({ method, id, action, body })
    const device = this.devices.get(id)
    if (!device) return { status: 404, body: { error: 'Dit toestel is niet (meer) gekoppeld aan deze organisatie', code: 'device_not_found' } }
    if (!action) {
      if (method === 'GET') return { status: 200, body: device }
      if (method === 'PATCH') {
        device.name = body?.name ?? device.name
        return { status: 200, body: device }
      }
      if (method === 'DELETE') {
        if (this.memberRole !== 'admin') return { status: 403, body: { error: 'Forbidden' } }
        this.devices.delete(id)
        return { status: 200, body: { ok: true } }
      }
    }
    if (action === 'display') {
      // Like the backend: the kassa's own display, the same one every time.
      for (const d of this.devices.values()) if (d.linked_to === id) d.linked_to = null
      const terminalId = `display-of-${id}`
      this.devices.set(terminalId, { terminal_id: terminalId, org_id: 'org-e2e', role: 'cfd', linked_to: id, name: `${device.name ?? 'Kassa'} · klantscherm` })
      return { status: 201, body: { terminalId } }
    }
    if (action === 'linked') return { status: 200, body: [...this.devices.values()].find((d) => d.linked_to === id) ?? null }
    if (action === 'linkable') return { status: 200, body: [...this.devices.values()].filter((d) => d.role === 'cfd' && !d.linked_to) }
    if (action === 'link') {
      const target = this.devices.get(body?.terminalId)
      if (!target) return { status: 404, body: { error: 'x', code: 'device_not_found' } }
      target.linked_to = id
      return { status: 200, body: target }
    }
    if (action === 'unlink') {
      device.linked_to = null
      return { status: 200, body: device }
    }
    return { status: 200, body: { ok: true } } // reset
  }

  // The request handler — method, path (without origin) and parsed JSON body.
  handle(method: string, path: string, body: any): FakeResponse {
    const url = new URL(path, 'http://fake')
    const p = url.pathname

    if (p === '/whoami') return { status: 200, body: { name: 'Test Kassier', email: 'kassier@example.test' } }
    if (p === '/api/devices/ws-token') return { status: 200, body: { token: 'test-token' } }
    if (p === '/api/organizations/org-e2e/receipt-settings' && method === 'GET') return { status: 200, body: { enabled: this.receiptsEnabled } }
    if (p === '/api/organizations/org-e2e/printers' && method === 'GET') return { status: 200, body: this.printers }
    // Trusting a push printer (printer-trust.tsx): the command's one-time code.
    if (/^\/api\/organizations\/org-e2e\/printers\/[^/]+\/trust-code$/.test(p) && method === 'POST') return { status: 201, body: { code: 'code-1', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } }
    const receipt = p.match(/^\/api\/organizations\/org-e2e\/printers\/([^/]+)\/receipt$/)
    if (receipt && method === 'POST') {
      if (!this.receiptsEnabled) return { status: 409, body: { error: 'Bonnen printen staat niet aan (console, Toestellen)', code: 'receipts_off' } }
      this.receipts.push({ printerId: receipt[1], tabId: body.tabId, chargeId: body.chargeId, chargeStatus: this.charges.find((c) => c.id === body.chargeId)?.status })
      return { status: 201, body: { id: `job-${this.receipts.length}` } }
    }
    if (p === '/api/organizations' && method === 'GET')
      return { status: 200, body: [{ id: 'org-e2e', name: 'E2E', demo: this.demoExpiresAt ? { expiresAt: this.demoExpiresAt, installUrl: null } : null }] }
    if (p === '/api/organizations/memberships' && method === 'GET') return { status: 200, body: [{ orgId: 'org-e2e', orgName: 'E2E', role: this.memberRole }] }
    if (p === '/api/organizations/device-pairings/claim' && method === 'POST') return this.claim(String(body?.code ?? ''))
    // Like the backend: a station screen's or customer display's code pairs here, a kassa's needs the session claim.
    // The customer display's logo and colours (arcanum-backend branding.ts): the event's colours win.
    const brand = p.match(/^\/api\/public\/branding\/([^/]+)$/)
    if (brand && method === 'GET') {
      this.brandingRequests.push({ orgId: decodeURIComponent(brand[1]), eventId: url.searchParams.get('event') })
      const own = url.searchParams.get('event') ? this.eventBranding.get(url.searchParams.get('event')!) : undefined
      return { status: 200, body: { primary: own?.primary ?? this.branding.primary, accent: own?.accent ?? this.branding.accent, logoUrl: this.branding.logoUrl } }
    }
    if (p === '/api/public/pair' && method === 'POST') {
      const key = String(body?.code ?? '').toUpperCase().replace(/[\s-]/g, '')
      const entry = [...this.pairingCodes].find(([c]) => c.replace('-', '') === key)
      if (entry && entry[1].role === 'pos') return { status: 401, body: { error: 'Een kassa koppel je terwijl je aangemeld bent - meld je eerst aan', code: 'pairing_needs_login', role: 'pos' } }
      return this.claim(key)
    }
    // The order being entered (customer-view.ts): the kassa sends it, a display fetches its kassa's.
    const view = p.match(/^\/api\/organizations\/[^/]+\/devices\/([^/]+)\/customer-view$/)
    if (view && method === 'PUT') {
      this.customerViewPuts.push({ terminal: decodeURIComponent(view[1]), ...body })
      return { status: 200, body: { shown: true } }
    }
    if (view && method === 'GET') return { status: 200, body: this.customerView }
    const device = p.match(/^\/api\/organizations\/([^/]+)\/devices\/([^/]+)(?:\/(display|linked|linkable|link|unlink|reset))?$/)
    if (device) return this.handleDevice(method, decodeURIComponent(device[2]), device[3], body)

    if (/^\/api\/organizations\/[^/]+\/events$/.test(p) && method === 'GET') return { status: 200, body: this.events }
    const registerResponse = this.registerRoute(method, p, body)
    if (registerResponse) return registerResponse
    if (/^\/api\/organizations\/[^/]+\/staff$/.test(p) && method === 'GET') return { status: 200, body: { required: this.staffRequired, staff: this.staff } }
    const staffToken = p.match(/^\/api\/organizations\/[^/]+\/staff\/([^/]+)\/token$/)
    if (staffToken) {
      const member = this.staff.find((s) => s.id === staffToken[1])!
      return { status: 200, body: { token: `tok-${member.id}`, staff: { id: member.id, name: member.name } } }
    }

    const catalogs = p.match(/^\/api\/organizations\/[^/]+\/catalogs(?:\/([^/]+)\/(kassa))?$/)
    if (catalogs && method === 'GET') return this.handleCatalogs(catalogs[1], catalogs[2])

    const tabs = p.match(/^\/api\/organizations\/[^/]+\/tabs(?:\/([^/]+))?(?:\/(orders|cancel|split|lines\/([^/]+)\/void))?$/)
    if (tabs) return this.handleTabs(method, url, body, tabs[1], tabs[2], tabs[3])

    if (method === 'POST' && (p === '/api/bancontact/sumup/charge' || p === '/api/bancontact/payments')) {
      return this.createCharge(p.endsWith('/payments') ? 'bancontact' : body.method || 'sumup', body)
    }
    if (method === 'GET' && p === '/api/bancontact/sumup/readers')
      return this.readersFail
        ? { status: 502, body: { error: 'x', code: 'sumup_readers_failed', configured: true, readers: [], tapToPay: this.tapToPay } }
        : { status: 200, body: { readers: [], tapToPay: this.tapToPay } }
    if (method === 'POST' && p === '/api/bancontact/sumup/confirm') {
      // Tap to Pay: never confirmed by hand; a cancel asks SumUp first.
      const app = this.charges.find((c) => c.id === body.chargeId && c.body?.app)
      if (app) {
        if (body.success !== false) return { status: 409, body: { error: 'x', code: 'tap_payment_not_manual' } }
        this.resolveCharge(app.id, this.tapPaidAtSumup)
        return { status: 200, body: { ok: true, chargeId: app.id, status: app.status } }
      }
      // A Bancontact QR or a SumUp reader cancelled: the provider is asked first
      // (arcanum-backend) — unreachable (cancelUnreachable), it stays pending.
      const charge = this.charges.find((c) => c.id === body.chargeId)
      if (body.success === false && charge && charge.status === 'pending' && charge.method === 'bancontact') {
        if (this.cancelUnreachable) return { status: 409, body: { error: 'x', code: 'payment_cancel_unconfirmed' } }
        this.resolveCharge(charge.id, false)
        return { status: 200, body: { ok: true, chargeId: charge.id, status: charge.status } }
      }
      this.resolveCharge(body.chargeId, body.success !== false)
      return { status: 200, body: { ok: true, chargeId: body.chargeId } }
    }
    const status = p.match(/^\/api\/bancontact\/sumup\/status\/([^/]+)$/)
    if (status) {
      const c = this.charges.find((x) => x.id === status[1])
      if (!c) return { status: 404, body: { error: 'Unknown chargeId' } }
      return {
        status: 200,
        body: {
          status: c.status,
          // As the real backend stores it: each provider's own word (SumUp's
          // reader callback: 'successful' / 'failed').
          providerStatus:
            c.method === 'bancontact'
              ? { pending: 'PENDING', succeeded: 'SUCCEEDED', failed: 'FAILED' }[c.status]
              : c.method === 'sumup'
                ? ({ succeeded: 'successful', failed: 'failed' } as Record<string, string>)[c.status] ?? null
                : null,
          amountCents: c.amountCents,
          tipCents: c.tipCents,
          method: c.method,
          qrCodeUrl: c.method === 'bancontact' ? QR_URL : null,
          expiresAt: null,
          order: c.tabId ? { ...this.customerOrder(c.tabId), paying: c.lines?.length ? c.lines.map((pick) => {
            const l = this.lines.find((x) => x.id === pick.lineId)!
            return { name: l.name, quantity: pick.quantity, unitPriceCents: l.unitPriceCents }
          }) : null } : null,
          splitPart: c.splitPart || null,
        },
      }
    }

    return { status: 404, body: { error: `fake backend: no route for ${method} ${p}` } }
  }

  private handleCatalogs(catalogId?: string, action?: string): FakeResponse {
    if (!catalogId) {
      return { status: 200, body: this.catalogs.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, isDefault: c.isDefault })) }
    }
    const catalog = this.catalogs.find((c) => !c.archived && (catalogId === 'default' ? c.isDefault : c.id === catalogId))
    if (!catalog || action !== 'kassa') return { status: 404, body: { error: 'Geen menukaart gevonden', code: 'no_catalog' } }
    return {
      status: 200,
      body: {
        id: catalog.id,
        name: catalog.name,
        updatedAt: '2026-09-25T00:00:00.000Z',
        sections: catalog.sections
          .map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color ?? null,
            entries: s.entries.filter((e) => e.visible).map(({ visible: _visible, ...e }) => e),
          }))
          .filter((s) => s.entries.length > 0),
      },
    }
  }

  // Lines get name/price/code from the catalog entry (client values
  // ignored); free lines are refused. A string is the 400 error.
  private priceLines(lines: OrderLineInput[], catalogId: string | undefined): FakeLineInput[] | string {
    const priced: FakeLineInput[] = []
    for (const l of lines) {
      if (!('variantId' in l) || !l.variantId) return FREE_LINE_REFUSAL
      if (!catalogId) return 'catalogId is required for lines with a variantId'
      const catalog = this.catalogs.find((c) => c.id === catalogId && !c.archived)
      if (!catalog) return UNKNOWN_CATALOG
      const e = catalog.sections.flatMap((s) => s.entries).find((x) => x.variantId === l.variantId && x.visible)
      if (!e) return MENUKAART_REFUSAL
      priced.push({ itemCode: e.code, variantId: e.variantId, name: e.name, unitPriceCents: e.priceCents, quantity: l.quantity })
    }
    return priced
  }

  private handleTabs(method: string, url: URL, body: any, tabId?: string, action?: string, lineId?: string): FakeResponse {
    if (!tabId) {
      if (method === 'GET') {
        // Like the backend: status=all, and `since` keeps what was opened or
        // closed since then, or is still open — newest opened first.
        const status = url.searchParams.get('status') || 'open'
        const since = url.searchParams.get('since')
        const list = this.tabs
          .filter((t) => status === 'all' || t.status === status)
          .filter((t) => !since || t.status === 'open' || t.openedAt >= since || (t.closedAt ?? '') >= since)
          .sort((a, b) => (since ? b.openedAt.localeCompare(a.openedAt) || b.number - a.number : b.number - a.number))
        return { status: 200, body: list.map((t) => this.summary(t)) }
      }
      if (method === 'POST') {
        if (this.staffRequired && !this.currentStaff) return { status: 409, body: { error: 'Kies eerst wie er werkt (bovenaan het scherm)', code: 'staff_required' } }
        if (body.registerId && !this.shift) return { status: 409, body: { error: 'Deze kassa is niet open - doe eerst "Kassa openen"', code: 'register_closed' } }
        this.registerIdsSent.push(body.registerId ?? null)
        this.recordedStaff.push({ what: 'tab', staff: this.currentStaff })
        if (body.eventId != null && !this.events.some((e) => e.id === body.eventId)) {
          return { status: 400, body: { error: 'Onbekend evenement - kies het opnieuw in de instellingen van de kassa', code: 'unknown_event' } }
        }
        const priced = body.lines?.length ? this.priceLines(body.lines, body.catalogId) : []
        if (typeof priced === 'string') return { status: 400, body: { error: priced, code: REFUSAL_CODES[priced] } }
        // Like the backend: a kassa mode of that event; left out, its only one.
        const ev = this.events.find((e) => e.id === body.eventId)
        const kassaModes = ev?.kassaModes ? (ev.modes ?? []) : []
        const mode = body.orderModeId ? kassaModes.find((x) => x.id === body.orderModeId) : kassaModes.length === 1 ? kassaModes[0] : undefined
        if (body.orderModeId && !mode) return { status: 400, body: { error: 'Onbekende bestelwijze - kies ze opnieuw', code: 'unknown_order_mode' } }
        const tab = this.openTab(body.label || '')
        tab.eventId = body.eventId ?? null
        tab.orderModeId = mode?.id ?? null
        const allModes = this.events.find((e) => e.id === body.eventId)?.modes ?? []
        tab.orderMode = mode && allModes.length > 1 ? mode.name : null
        tab.openedDeviceName = body.deviceName || null
        if (priced.length) this.addOrder(tab.id, priced)
        return { status: 201, body: this.detail(tab) }
      }
    }
    const tab = tabId ? this.tab(tabId) : undefined
    if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden', code: 'tab_not_found' } }

    if (!action && method === 'GET') return { status: 200, body: this.detail(tab) }
    if (!action && method === 'PATCH') {
      if (tab.status !== 'open') return this.refusal(tab.id)
      tab.label = body.label || ''
      return { status: 200, body: this.detail(tab) }
    }
    if (action === 'orders' && method === 'POST') {
      if (!Array.isArray(body.lines) || body.lines.length === 0) return { status: 400, body: { error: 'lines must be a non-empty array' } }
      const priced = this.priceLines(body.lines, body.catalogId)
      if (typeof priced === 'string') return { status: 400, body: { error: priced, code: REFUSAL_CODES[priced] } }
      if (!this.writable(tab.id)) return this.refusal(tab.id)
      this.addOrder(tab.id, priced)
      return { status: 201, body: this.detail(tab) }
    }
    if (action === 'split' && method === 'POST') {
      const parts = body.parts
      if (parts !== null && (!Number.isInteger(parts) || parts < 2 || parts > 50)) return { status: 400, body: { error: 'parts must be an integer 2-50, or null' } }
      if (!this.writable(tab.id)) return this.refusal(tab.id)
      if (parts !== null && this.summary(tab).outstandingCents < parts) return { status: 409, body: { error: 'Te weinig open om zo te verdelen', code: 'split_too_small', tab: this.summary(tab) } }
      tab.splitParts = parts
      tab.splitPaid = 0
      return { status: 200, body: this.detail(tab) }
    }
    if (action === 'cancel' && method === 'POST') {
      const anyPayment = this.charges.some((c) => c.tabId === tab.id && c.status !== 'failed')
      // "Ticket annuleren": every line voided with the reason first, like the backend (one step).
      if (body?.voidAll) {
        if (!body.reason?.trim()) return { status: 400, body: { error: 'reason is required' } }
        if (tab.status !== 'open' || anyPayment) return this.refusal(tab.id)
        this.cancelAllRequests.push({ tabId: tab.id, reason: body.reason })
        const orderId = nextId('order')
        this.lineTab.set(orderId, tab.id)
        for (const original of this.tabLines(tab.id).filter((l) => !l.voidsLineId)) {
          const remaining = original.quantity + this.lines.filter((v) => v.voidsLineId === original.id).reduce((n, v) => n + v.quantity, 0)
          if (remaining > 0) this.lines.push({ ...original, id: nextId('line'), orderId, quantity: -remaining, voidsLineId: original.id, voidReason: body.reason, createdAt: new Date().toISOString() })
        }
      }
      const s = this.summary(tab)
      if (tab.status !== 'open' || s.totalCents !== 0 || anyPayment) return this.refusal(tab.id)
      tab.status = 'cancelled'
      tab.closedAt = new Date().toISOString()
      return { status: 200, body: this.detail(tab) }
    }
    if (lineId && method === 'POST') {
      if (!body.reason?.trim()) return { status: 400, body: { error: 'reason is required' } }
      const original = this.tabLines(tab.id).find((l) => l.id === lineId && !l.voidsLineId)
      if (!original) return { status: 404, body: { error: 'Lijn niet gevonden', code: 'line_not_found' } }
      const remaining = original.quantity + this.lines.filter((v) => v.voidsLineId === lineId).reduce((s, v) => s + v.quantity, 0)
      const quantity = body.quantity ?? remaining
      if (!this.writable(tab.id) || quantity < 1 || quantity > remaining) return this.refusal(tab.id)
      if (quantity > remaining - this.paidUnits(lineId)) {
        return { status: 409, body: { error: 'Deze stuks zijn al betaald - ze kunnen niet meer geannuleerd worden', code: 'void_units_paid', tab: this.summary(tab) } }
      }
      const s = this.summary(tab)
      if (s.totalCents - quantity * original.unitPriceCents < s.paidCents) {
        return { status: 409, body: { error: 'Er is al een deel betaald - annuleren zou meer terugbetalen dan er open staat', code: 'void_exceeds_outstanding', tab: s } }
      }
      const orderId = nextId('order')
      this.lineTab.set(orderId, tab.id)
      this.lines.push({ ...original, id: nextId('line'), orderId, quantity: -quantity, voidsLineId: lineId, voidReason: body.reason, createdAt: new Date().toISOString() })
      return { status: 201, body: this.detail(tab) }
    }
    return { status: 404, body: { error: 'fake backend: unknown tab route' } }
  }

  private addOrder(tabId: string, lines: FakeLineInput[]) {
    const orderId = nextId('order')
    this.lineTab.set(orderId, tabId)
    for (const l of lines) {
      this.lines.push({
        id: nextId('line'),
        orderId,
        itemCode: l.itemCode ?? null,
        variantId: l.variantId ?? null,
        name: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        category: l.category ?? null,
        voidsLineId: null,
        voidReason: null,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Like the backend's customerOrder: the tab's lines net of voids.
  customerOrder(tabId: string) {
    const tab = this.tab(tabId)
    if (!tab) return null
    const detail = this.detail(tab) as any
    return {
      label: detail.label,
      number: detail.number,
      eventNumber: tab.eventNumber ?? null,
      followUrl: tab.followUrl ?? null,
      eventName: detail.eventName,
      split: detail.split ? { parts: detail.split.parts, paid: detail.split.paid } : null,
      paidCents: detail.paidCents,
      lines: detail.lines
        .filter((l: any) => !l.voidsLineId && l.quantity - l.voidedQuantity > 0)
        .map((l: any) => ({ name: l.name, quantity: l.quantity - l.voidedQuantity, unitPriceCents: l.unitPriceCents, category: l.category ?? null })),
    }
  }

  private createCharge(method: string, body: any): FakeResponse {
    if (this.staffRequired && !this.currentStaff) return { status: 409, body: { error: 'Kies eerst wie er werkt (bovenaan het scherm)', code: 'staff_required' } }
    if (body.registerId && !this.shift) return { status: 409, body: { error: 'Deze kassa is niet open - doe eerst "Kassa openen"', code: 'register_closed' } }
    this.registerIdsSent.push(body.registerId ?? null)
    if (body.registerId && method === 'cash') this.shiftCash += body.amount
    this.recordedStaff.push({ what: 'charge', staff: this.currentStaff })
    if (this.beforeNextCharge) {
      const hook = this.beforeNextCharge
      this.beforeNextCharge = null
      hook()
    }
    const tabId: string | null = body.tabId || null
    const tipCents = body.tipCents ?? 0
    if (!Number.isInteger(tipCents) || tipCents < 0 || tipCents > 100_000) return { status: 400, body: { error: 'tipCents must be an integer between 0 and 100000' } }
    if (tabId) {
      const tab = this.tab(tabId)
      if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden', code: 'tab_not_found' } }
      const s = this.summary(tab)
      if (tab.status !== 'open') return { status: 409, body: { error: 'Rekening is niet meer open', code: 'tab_not_open', tab: s } }
      if (s.paymentPending) return { status: 409, body: { error: 'Er loopt al een betaling voor deze rekening', code: 'tab_payment_already_pending', tab: s } }
      // The kassa's intent, checked exactly (like the backend's prepareTabCharge).
      const pays = body.amount - tipCents
      if (body.lines !== undefined) {
        const detail = this.detail(this.tab(tabId)!) as any
        let cents = 0
        for (const pick of body.lines as { lineId: string; quantity: number }[]) {
          const l = detail.lines.find((x: any) => x.id === pick.lineId && !x.voidsLineId)
          if (!l || pick.quantity > l.quantity - l.voidedQuantity - l.paidQuantity) return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', code: 'tab_changed', tab: s } }
          cents += pick.quantity * l.unitPriceCents
        }
        if (cents !== pays) return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', code: 'tab_changed', tab: s } }
      }
      const expected = body.lines !== undefined ? pays >= 1 && pays <= s.outstandingCents : body.splitPart === true ? pays === s.split?.nextCents : body.partial === true ? pays >= 1 && pays <= s.outstandingCents : pays === s.outstandingCents
      if (!expected) return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', code: 'tab_changed', tab: s } }
    }
    const tab = tabId ? this.tab(tabId) : undefined
    const splitPart = body.splitPart === true && tab?.splitParts ? (tab.splitPaid || 0) + 1 : 0
    const charge: FakeCharge = { id: nextId('charge'), tabId, method, status: 'pending', amountCents: body.amount, tipCents, splitPart, lines: body.lines, body }
    this.charges.push(charge)
    if (method === 'bancontact') {
      return { status: 201, body: { chargeId: charge.id, status: 'PENDING', amount: body.amount, expiresAt: new Date(Date.now() + 120_000).toISOString(), qrCodeUrl: QR_URL } }
    }
    if (body.app) return { status: 201, body: { chargeId: charge.id, sumupApp: { affiliateKey: 'sup_afk_test', appId: 'be.example.pos' }, tapToken: `tok-${charge.id}` } }
    return { status: 201, body: { chargeId: charge.id } }
  }
}

const QR_URL =
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
