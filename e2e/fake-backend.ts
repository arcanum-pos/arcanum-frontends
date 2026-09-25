// In-memory stand-in for the parts of arcanum-backend the kassa talks to
// (tabs API + charge endpoints), so the E2E suite runs with no Worker, no
// D1 and no login. It mirrors the rules arcanum-backend/src/tabs.ts
// enforces — amount must equal outstanding, one pending charge per tab,
// closed tabs refuse orders, cancel only when empty — with the same
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
  receiptNumber: number | null
}

export interface FakeCharge {
  id: string
  tabId: string | null
  method: string
  status: 'pending' | 'succeeded' | 'failed'
  amountCents: number
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
    const charge: FakeCharge = { id: nextId('charge'), tabId, method, status: 'pending', amountCents: this.summary(this.tab(tabId)!).outstandingCents }
    this.charges.push(charge)
    return charge
  }

  resolveCharge(chargeId: string, success: boolean) {
    const charge = this.charges.find((c) => c.id === chargeId)
    if (!charge || charge.status !== 'pending') return
    charge.status = success ? 'succeeded' : 'failed'
    if (success && charge.tabId) this.settle(charge.tabId)
  }

  tabByLabel(label: string): Tab | undefined {
    return this.tabs.find((t) => t.label === label)
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
    const paidCents = charges.filter((c) => c.status === 'succeeded').reduce((s, c) => s + c.amountCents, 0)
    return {
      ...tab,
      totalCents,
      paidCents,
      outstandingCents: totalCents - paidCents,
      paymentPending: charges.some((c) => c.status === 'pending'),
    }
  }

  private detail(tab: Tab) {
    const lines = this.tabLines(tab.id)
    return {
      ...this.summary(tab),
      lines: lines.map((l) => ({
        ...l,
        voidedQuantity: -lines.filter((v) => v.voidsLineId === l.id).reduce((s, v) => s + v.quantity, 0),
      })),
    }
  }

  private settle(tabId: string) {
    const tab = this.tab(tabId)!
    const s = this.summary(tab)
    if (tab.status === 'open' && s.paidCents >= s.totalCents) {
      tab.status = 'closed'
      tab.receiptNumber = ++this.receiptCounter
    }
  }

  private refusal(tabId: string): FakeResponse {
    const tab = this.tab(tabId)
    if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden' } }
    const s = this.summary(tab)
    if (tab.status !== 'open') return { status: 409, body: { error: 'Rekening is niet meer open', tab: s } }
    if (s.paymentPending) return { status: 409, body: { error: 'Er loopt een betaling voor deze rekening', tab: s } }
    return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', tab: s } }
  }

  private writable(tabId: string) {
    const tab = this.tab(tabId)
    return !!tab && tab.status === 'open' && !this.summary(tab).paymentPending
  }

  // The request handler — method, path (without origin) and parsed JSON body.
  handle(method: string, path: string, body: any): FakeResponse {
    const url = new URL(path, 'http://fake')
    const p = url.pathname

    if (p === '/whoami') return { status: 200, body: { name: 'Test Kassier', email: 'kassier@example.test' } }
    if (p === '/api/bancontact/settings') return { status: 200, body: {} }
    if (p.startsWith('/api/devices/')) {
      if (p.endsWith('/ws-token')) return { status: 200, body: { token: 'test-token' } }
      return { status: 200, body: { ok: true } }
    }

    const tabs = p.match(/^\/api\/organizations\/[^/]+\/tabs(?:\/([^/]+))?(?:\/(orders|cancel|lines\/([^/]+)\/void))?$/)
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
          method: c.method,
          qrCodeUrl: c.method === 'bancontact' ? QR_URL : null,
          expiresAt: null,
        },
      }
    }

    return { status: 404, body: { error: `fake backend: no route for ${method} ${p}` } }
  }

  private handleTabs(method: string, url: URL, body: any, tabId?: string, action?: string, lineId?: string): FakeResponse {
    if (!tabId) {
      if (method === 'GET') {
        const status = url.searchParams.get('status') || 'open'
        return { status: 200, body: this.tabs.filter((t) => t.status === status).sort((a, b) => b.number - a.number).map((t) => this.summary(t)) }
      }
      if (method === 'POST') {
        const tab = this.openTab(body.label || '')
        tab.openedDeviceName = body.deviceName || null
        if (body.lines?.length) this.addOrder(tab.id, body.lines)
        return { status: 201, body: this.detail(tab) }
      }
    }
    const tab = tabId ? this.tab(tabId) : undefined
    if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden' } }

    if (!action && method === 'GET') return { status: 200, body: this.detail(tab) }
    if (!action && method === 'PATCH') {
      if (tab.status !== 'open') return this.refusal(tab.id)
      tab.label = body.label || ''
      return { status: 200, body: this.detail(tab) }
    }
    if (action === 'orders' && method === 'POST') {
      if (!Array.isArray(body.lines) || body.lines.length === 0) return { status: 400, body: { error: 'lines must be a non-empty array' } }
      if (!this.writable(tab.id)) return this.refusal(tab.id)
      this.addOrder(tab.id, body.lines)
      return { status: 201, body: this.detail(tab) }
    }
    if (action === 'cancel' && method === 'POST') {
      const s = this.summary(tab)
      const anyPayment = this.charges.some((c) => c.tabId === tab.id && c.status !== 'failed')
      if (tab.status !== 'open' || s.totalCents !== 0 || anyPayment) return this.refusal(tab.id)
      tab.status = 'cancelled'
      return { status: 200, body: this.detail(tab) }
    }
    if (lineId && method === 'POST') {
      if (!body.reason?.trim()) return { status: 400, body: { error: 'reason is required' } }
      const original = this.tabLines(tab.id).find((l) => l.id === lineId && !l.voidsLineId)
      if (!original) return { status: 404, body: { error: 'Lijn niet gevonden' } }
      const remaining = original.quantity + this.lines.filter((v) => v.voidsLineId === lineId).reduce((s, v) => s + v.quantity, 0)
      const quantity = body.quantity ?? remaining
      if (!this.writable(tab.id) || quantity < 1 || quantity > remaining) return this.refusal(tab.id)
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

  private createCharge(method: string, body: any): FakeResponse {
    if (this.beforeNextCharge) {
      const hook = this.beforeNextCharge
      this.beforeNextCharge = null
      hook()
    }
    const tabId: string | null = body.tabId || null
    if (tabId) {
      const tab = this.tab(tabId)
      if (!tab) return { status: 404, body: { error: 'Rekening niet gevonden' } }
      const s = this.summary(tab)
      if (tab.status !== 'open') return { status: 409, body: { error: 'Rekening is niet meer open', tab: s } }
      if (s.paymentPending) return { status: 409, body: { error: 'Er loopt al een betaling voor deze rekening', tab: s } }
      if (body.amount !== s.outstandingCents) return { status: 409, body: { error: 'Rekening is gewijzigd, herlaad en probeer opnieuw', tab: s } }
    }
    const charge: FakeCharge = { id: nextId('charge'), tabId, method, status: 'pending', amountCents: body.amount }
    this.charges.push(charge)
    if (method === 'bancontact') {
      return { status: 201, body: { chargeId: charge.id, status: 'PENDING', amount: body.amount, expiresAt: new Date(Date.now() + 120_000).toISOString(), qrCodeUrl: QR_URL } }
    }
    return { status: 201, body: { chargeId: charge.id } }
  }
}

const QR_URL =
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
