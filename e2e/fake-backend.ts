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
  name: string
  unitPriceCents: number
  quantity: number
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
  sections: { id: string; name: string; entries: FakeEntry[] }[]
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

const MENUKAART_REFUSAL = 'Dit product staat niet (meer) op de menukaart — herlaad de kassa'
const UNKNOWN_CATALOG = 'Onbekende of gearchiveerde menukaart'
// arcanum-backend's error codes (src/errors.ts) for the refusals above.
const REFUSAL_CODES: Record<string, string> = { [MENUKAART_REFUSAL]: 'product_not_on_catalog', [UNKNOWN_CATALOG]: 'unknown_catalog' }

interface Line {
  id: string
  orderId: string
  itemCode: string | null
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
  // "Gelijk verdelen" plan, like the backend's tabs.split_parts / split_paid.
  splitParts?: number | null
  splitPaid?: number
}

export interface FakeEvent {
  id: string
  name: string
  date: string
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

  private tabLines(tabId: string) {
    return this.lines.filter((l) => this.lineTab.get(l.orderId) === tabId)
  }

  // orderId -> tabId, so lines don't need their own tabId field.
  private lineTab = new Map<string, string>()

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
  devices = new Map<string, { terminal_id: string; org_id: string; role: string; linked_to: string | null; name: string | null }>([
    ['pos-e2e', { terminal_id: 'pos-e2e', org_id: 'org-e2e', role: 'pos', linked_to: null, name: 'Kassa 1' }],
  ])
  // Pairing codes a test made "in the console": code (as shown) → role + name.
  pairingCodes = new Map<string, { role: 'pos' | 'cfd'; name: string }>()
  // The signed-in person's role in org-e2e (Instellingen's Beheer is for admins).
  memberRole: 'admin' | 'cashier' = 'cashier'
  deviceCalls: { method: string; id: string; action?: string; body?: any }[] = []

  private claim(code: string): FakeResponse {
    const key = code.toUpperCase().replace(/[\s-]/g, '')
    const entry = [...this.pairingCodes].find(([c]) => c.replace('-', '') === key)
    if (!entry) return { status: 400, body: { error: 'Deze koppelcode klopt niet, is al gebruikt of is verlopen — vraag een beheerder om een nieuwe', code: 'pairing_code_invalid' } }
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
    if (p === '/api/organizations/memberships' && method === 'GET') return { status: 200, body: [{ orgId: 'org-e2e', orgName: 'E2E', role: this.memberRole }] }
    if (p === '/api/organizations/device-pairings/claim' && method === 'POST') return this.claim(String(body?.code ?? ''))
    const device = p.match(/^\/api\/organizations\/([^/]+)\/devices\/([^/]+)(?:\/(display|linked|linkable|link|unlink|reset))?$/)
    if (device) return this.handleDevice(method, decodeURIComponent(device[2]), device[3], body)

    if (/^\/api\/organizations\/[^/]+\/events$/.test(p) && method === 'GET') return { status: 200, body: this.events }

    const catalogs = p.match(/^\/api\/organizations\/[^/]+\/catalogs(?:\/([^/]+)\/(kassa))?$/)
    if (catalogs && method === 'GET') return this.handleCatalogs(catalogs[1], catalogs[2])

    const tabs = p.match(/^\/api\/organizations\/[^/]+\/tabs(?:\/([^/]+))?(?:\/(orders|cancel|split|lines\/([^/]+)\/void))?$/)
    if (tabs) return this.handleTabs(method, url, body, tabs[1], tabs[2], tabs[3])

    if (method === 'POST' && (p === '/api/bancontact/sumup/charge' || p === '/api/bancontact/payments')) {
      return this.createCharge(p.endsWith('/payments') ? 'bancontact' : body.method || 'sumup', body)
    }
    if (method === 'POST' && p === '/api/bancontact/sumup/confirm') {
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
          providerStatus: c.method === 'bancontact' ? { pending: 'PENDING', succeeded: 'SUCCEEDED', failed: 'FAILED' }[c.status] : null,
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
      priced.push({ itemCode: e.code, name: e.name, unitPriceCents: e.priceCents, quantity: l.quantity })
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
        if (body.eventId != null && !this.events.some((e) => e.id === body.eventId)) {
          return { status: 400, body: { error: 'Onbekend evenement — kies het opnieuw in de instellingen van de kassa', code: 'unknown_event' } }
        }
        const priced = body.lines?.length ? this.priceLines(body.lines, body.catalogId) : []
        if (typeof priced === 'string') return { status: 400, body: { error: priced, code: REFUSAL_CODES[priced] } }
        const tab = this.openTab(body.label || '')
        tab.eventId = body.eventId ?? null
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
      if (parts !== null && (!Number.isInteger(parts) || parts < 2 || parts > 50)) return { status: 400, body: { error: 'parts must be an integer 2–50, or null' } }
      if (!this.writable(tab.id)) return this.refusal(tab.id)
      if (parts !== null && this.summary(tab).outstandingCents < parts) return { status: 409, body: { error: 'Te weinig open om zo te verdelen', code: 'split_too_small', tab: this.summary(tab) } }
      tab.splitParts = parts
      tab.splitPaid = 0
      return { status: 200, body: this.detail(tab) }
    }
    if (action === 'cancel' && method === 'POST') {
      const s = this.summary(tab)
      const anyPayment = this.charges.some((c) => c.tabId === tab.id && c.status !== 'failed')
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
        return { status: 409, body: { error: 'Deze stuks zijn al betaald — ze kunnen niet meer geannuleerd worden', code: 'void_units_paid', tab: this.summary(tab) } }
      }
      const s = this.summary(tab)
      if (s.totalCents - quantity * original.unitPriceCents < s.paidCents) {
        return { status: 409, body: { error: 'Er is al een deel betaald — annuleren zou meer terugbetalen dan er open staat', code: 'void_exceeds_outstanding', tab: s } }
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
        name: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
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
      eventName: detail.eventName,
      split: detail.split ? { parts: detail.split.parts, paid: detail.split.paid } : null,
      paidCents: detail.paidCents,
      lines: detail.lines
        .filter((l: any) => !l.voidsLineId && l.quantity - l.voidedQuantity > 0)
        .map((l: any) => ({ name: l.name, quantity: l.quantity - l.voidedQuantity, unitPriceCents: l.unitPriceCents })),
    }
  }

  private createCharge(method: string, body: any): FakeResponse {
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
    return { status: 201, body: { chargeId: charge.id } }
  }
}

const QR_URL =
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
