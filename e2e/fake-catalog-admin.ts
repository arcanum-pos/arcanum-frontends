// In-memory stand-in for arcanum-backend's catalog API (src/catalog.ts)
// plus the few calls the console shell makes on load (/whoami, the org
// list) and what the Rapporten page reads (the sales report, the payment
// list, events) — those three just return whatever a test put in
// `salesReport` / `transactions` / `events`. The catalog part enforces the
// same rules and returns the same status codes and Dutch messages as the
// real backend, so the console's error handling is exercised — the
// backend's own rules are tested for real in arcanum-backend's suite.
import { GROUP_COLORS } from '../src/shared/group-colors'

export interface FakeResponse {
  status: number
  body: unknown
}

interface Category {
  id: string
  name: string
  position: number
}
// Stations have the same shape as categories (who prepares it vs. what it is).
type Station = Category
interface Variant {
  id: string
  productId: string
  name: string
  code: string | null
  position: number
  archived: boolean
}
interface Product {
  id: string
  name: string
  categoryId: string | null
  prepStationId: string | null
  vatRateBp: number | null
  archived: boolean
}
interface Catalog {
  id: string
  name: string
  isDefault: boolean
  archived: boolean
}
interface Section {
  id: string
  catalogId: string
  name: string
  position: number
  color?: string | null
}
interface Entry {
  id: string
  catalogId: string
  sectionId: string
  variantId: string
  priceCents: number
  visible: boolean
  position: number
  quickQuantities: number[] | null
}

export const ORG_ID = 'org-e2e'

export function emptySalesReport(): any {
  return {
    from: '',
    to: '',
    payments: { count: 0, amountCents: 0, tipCents: 0, byMethod: [] },
    sales: { tabCount: 0, revenueCents: 0, byCategory: [], byProduct: [], byVat: [] },
    legacy: { count: 0, amountCents: 0, items: {} },
    openTabs: { count: 0, outstandingCents: 0 },
  }
}

export class FakeCatalogAdmin {
  categories: Category[] = []
  stations: Station[] = []
  // Medewerkers.
  staff: { id: string; name: string; hasPin: boolean; memberId: string | null; archived: boolean; createdAt: string }[] = []
  staffRequired = false
  staffCalls: { method: string; body: any }[] = []
  myRole: 'admin' | 'cashier' | 'waiter' = 'admin'
  orgIcons = new Map<string, { updatedAt: string; png: Record<string, string> }>()
  // Weergave → Klantscherm (arcanum-backend branding.ts).
  branding: { primary: string | null; accent: string | null; logo: { updatedAt: string; png: string } | null } = { primary: null, accent: null, logo: null }
  brandingCalls: any[] = []
  members: any[] = []
  tables: any[] = []
  // Kassalades.
  registers: { id: string; name: string; archived: boolean; open: boolean }[] = []
  blindCount = false
  shifts: any[] = []
  products: Product[] = []
  variants: Variant[] = []
  catalogs: Catalog[] = []
  sections: Section[] = []
  entries: Entry[] = []
  // Test hook: the next layout call is refused as if another admin edited
  // the catalog in between.
  failNextLayout = false
  // Rapporten page: served as-is. `reportStatus: 403` answers like the
  // backend does for a non-admin; every report query is recorded.
  salesReport: any = emptySalesReport()
  reportStatus = 200
  reportQueries: { from: string; to: string; event?: string }[] = []
  transactions: any[] = []
  events: any[] = []
  usedEvents = new Set<string>()
  eventCalls: { path: string; body: any }[] = []
  // Every import call (dry run or apply) as received — tests assert on the
  // raw rows the browser sent.
  importRequests: any[] = []
  // Toestellen: SumUp as the backend relays it (null = no SumUp account set
  // up), and every pair/unpair call as received. `pairError` answers the next
  // pairing like the backend does when SumUp refuses the code.
  sumupReaders: { id: string; name: string; status: string; model: string | null }[] | null = null
  sumupCalls: { method: string; path: string; body: any }[] = []
  pairError: string | null = null
  // Toestellen: the registered kassa's and customer displays (devicehub's /by-org).
  orgDevices: any[] = []
  // Printers (arcanum-backend printing.ts) and the test pages asked for.
  printers: any[] = []
  testPrints: string[] = []
  receiptsEnabled = false
  private seq = 0

  private id(prefix: string) {
    return `${prefix}-${++this.seq}`
  }

  handle(method: string, fullPath: string, body: any): FakeResponse {
    const [path, query = ''] = fullPath.split('?')
    if (path === '/whoami') return ok({ sub: 'admin', email: 'admin@e2e.test', name: 'Admin', firstName: 'Admin', lastName: '', username: 'admin' })
    if (path === '/api/organizations' && method === 'GET') {
      return ok([{ id: ORG_ID, name: 'E2E', logoUrl: null, theme: null, createdAt: '2026-01-01' }])
    }
    // The signed-in person's role here (release C: Bediening sees only the waiter screen).
    if (path === '/api/organizations/memberships' && method === 'GET') return ok([{ orgId: ORG_ID, orgName: 'E2E', role: this.myRole }])
    // Weergave → App-iconen: the org's own icons per page (arcanum-backend org-icons.ts).
    if (path === `/api/organizations/${ORG_ID}/icons` && method === 'GET') return ok([...this.orgIcons].map(([slot, i]) => ({ slot, updatedAt: i.updatedAt })))
    const brandingView = () => ({ primary: this.branding.primary, accent: this.branding.accent, logo: this.branding.logo ? { updatedAt: this.branding.logo.updatedAt } : null })
    if (path === `/api/organizations/${ORG_ID}/branding` && method === 'GET') return ok(brandingView())
    if (path === `/api/organizations/${ORG_ID}/branding` && method === 'PUT') {
      this.brandingCalls.push(body)
      for (const key of ['primary', 'accent'] as const) {
        if (body[key] === undefined) continue
        if (body[key] !== null && !/^#[0-9a-f]{6}$/i.test(body[key])) return { status: 400, body: { error: 'Kies een kleur als #rrggbb', code: 'branding_color_invalid' } }
        this.branding[key] = body[key] === null ? null : body[key].toLowerCase()
      }
      return ok(brandingView())
    }
    if (path === `/api/organizations/${ORG_ID}/branding/logo` && method === 'PUT') {
      this.branding.logo = { updatedAt: new Date().toISOString(), png: body.png }
      return ok(brandingView())
    }
    if (path === `/api/organizations/${ORG_ID}/branding/logo` && method === 'DELETE') {
      this.branding.logo = null
      return ok(brandingView())
    }
    const icon = path.match(/^\/api\/organizations\/[^/]+\/icons\/([^/]+)$/)
    if (icon && method === 'PUT') {
      const updatedAt = new Date().toISOString()
      this.orgIcons.set(decodeURIComponent(icon[1]), { updatedAt, png: body.png })
      return ok({ slot: decodeURIComponent(icon[1]), updatedAt })
    }
    if (icon && method === 'DELETE') {
      this.orgIcons.delete(decodeURIComponent(icon[1]))
      return ok({ ok: true })
    }
    if (/^\/api\/organizations\/[^/]+\/members$/.test(path) && method === 'GET') return ok(this.members)
    if (/^\/api\/organizations\/[^/]+\/members$/.test(path) && method === 'POST') {
      const member = { id: this.id('m'), invitedEmail: body.email, role: body.role, status: 'pending', invitedAt: new Date().toISOString(), userSub: null }
      this.members.push(member)
      return { status: 201, body: { ...member, mailSent: true } }
    }
    // Tafels (arcanum-backend tables.ts).
    if (/^\/api\/organizations\/[^/]+\/tables$/.test(path) && method === 'GET') return ok(this.tables)
    if (/^\/api\/organizations\/[^/]+\/tables$/.test(path) && method === 'POST') {
      const t = { id: this.id('table'), name: body.name, zone: body.zone ?? null, position: this.tables.length, archived: false, state: 'free', qrToken: `qr${this.tables.length}abcdefghijklmnop` }
      this.tables.push(t)
      return { status: 201, body: t }
    }

    if (/^\/api\/organizations\/[^/]+\/reports\/sales$/.test(path) && method === 'GET') {
      const params = new URLSearchParams(query)
      const range = { from: params.get('from') || '', to: params.get('to') || '' }
      this.reportQueries.push(params.get('event') ? { ...range, event: params.get('event')! } : range)
      if (this.reportStatus === 403) return { status: 403, body: { error: 'Forbidden' } }
      return ok({ ...this.salesReport, ...range })
    }
    if (path === '/api/bancontact/transactions' && method === 'GET') {
      const eventId = new URLSearchParams(query).get('eventId')
      return ok(eventId ? this.transactions.filter((t) => t.eventId === eventId) : this.transactions)
    }
    if (/^\/api\/organizations\/[^/]+\/devices$/.test(path) && method === 'GET') return ok(this.orgDevices)
    if (/^\/api\/organizations\/[^/]+\/receipt-settings$/.test(path)) {
      if (method === 'PUT') this.receiptsEnabled = body.enabled
      return ok({ enabled: this.receiptsEnabled })
    }
    const printer = path.match(/^\/api\/organizations\/[^/]+\/printers(?:\/([^/]+))?(?:\/(test|key))?$/)
    if (printer) {
      const stationsOf = (ids: string[]) => this.stations.filter((st) => ids.includes(st.id)).map((st) => ({ id: st.id, name: st.name }))
      if (!printer[1] && method === 'GET') return ok(this.printers)
      if (!printer[1] && method === 'POST') {
        const poll = body.connection === 'poll'
        const p = { id: this.id('printer'), name: body.name, brand: body.brand, connection: body.connection, host: poll ? null : body.host, port: poll ? null : body.port, deviceId: 'local_printer', paperMm: body.paperMm, lastPollAt: null, stations: stationsOf(body.stationIds ?? []) }
        this.printers.push(p)
        return { status: 201, body: poll ? { ...p, pollKey: `key-${p.id}` } : p }
      }
      const p = this.printers.find((x) => x.id === printer[1])
      if (!p) return { status: 404, body: { error: 'Printer niet gevonden', code: 'printer_not_found' } }
      if (printer[2] === 'key' && method === 'GET') return ok({ pollKey: p.pollKey ?? null })
      if (printer[2] === 'key') return ok({ ...p, pollKey: `new-key-${p.id}` })
      if (printer[2] === 'test') {
        this.testPrints.push(p.id)
        return { status: 201, body: { id: this.id('job') } }
      }
      if (method === 'PATCH') {
        Object.assign(p, { name: body.name ?? p.name, host: body.host ?? p.host, port: body.port ?? p.port, paperMm: body.paperMm ?? p.paperMm }, body.stationIds ? { stations: stationsOf(body.stationIds) } : {})
        return ok(p)
      }
      if (method === 'DELETE') {
        this.printers = this.printers.filter((x) => x.id !== p.id)
        return ok({ ok: true })
      }
    }
    const device = path.match(/^\/api\/organizations\/[^/]+\/devices\/([^/]+)$/)
    if (device && method === 'DELETE') {
      this.orgDevices = this.orgDevices.filter((d) => d.terminal_id !== decodeURIComponent(device[1]))
      return ok({ ok: true })
    }
    if (/^\/api\/organizations\/[^/]+\/device-pairings(\/.*)?$/.test(path)) return this.pairingRoute(method, path, body)
    // "Opnieuw koppelen": a code for an existing device.
    const repair = path.match(/^\/api\/organizations\/[^/]+\/devices\/([^/]+)\/repair$/)
    if (repair && method === 'POST') {
      const existing = this.orgDevices.find((d) => d.terminal_id === decodeURIComponent(repair[1]))
      if (!existing) return { status: 404, body: { error: 'x', code: 'device_not_found' } }
      return this.pairingRoute('POST', '/device-pairings', { role: existing.role, name: existing.name, repairs: existing.terminal_id })
    }
    // Kassalades and shifts (arcanum-backend shifts.ts).
    if (/^\/api\/organizations\/[^/]+\/registers$/.test(path) && method === 'GET') return ok({ blindCount: this.blindCount, registers: this.registers })
    if (/^\/api\/organizations\/[^/]+\/registers$/.test(path) && method === 'POST') {
      const r = { id: this.id('reg'), name: body.name, archived: false, open: false }
      this.registers.push(r)
      return { status: 201, body: r }
    }
    const reg = path.match(/^\/api\/organizations\/[^/]+\/registers\/([^/]+)$/)
    if (reg && method === 'PATCH') {
      const r = this.registers.find((x) => x.id === reg[1])!
      if (body.archived && r.open) return { status: 409, body: { error: 'x', code: 'register_open' } }
      Object.assign(r, body)
      return ok(r)
    }
    if (/^\/api\/organizations\/[^/]+\/shift-settings$/.test(path) && method === 'PUT') {
      this.blindCount = !!body.blindCount
      return ok({ blindCount: this.blindCount })
    }
    if (/^\/api\/organizations\/[^/]+\/shifts$/.test(path) && method === 'GET') return ok(this.shifts)
    // Medewerkers (arcanum-backend staff.ts).
    if (/^\/api\/organizations\/[^/]+\/staff-settings$/.test(path) && method === 'PUT') {
      this.staffRequired = !!body.required
      return ok({ required: this.staffRequired })
    }
    if (/^\/api\/organizations\/[^/]+\/staff(\?all=1)?$/.test(path) && method === 'GET') return ok({ required: this.staffRequired, staff: this.staff })
    if (/^\/api\/organizations\/[^/]+\/staff$/.test(path) && method === 'POST') {
      if (this.staff.some((s) => !s.archived && s.name.toLowerCase() === String(body.name).toLowerCase())) return { status: 409, body: { error: 'x', code: 'staff_name_taken' } }
      const member = { id: this.id('staff'), name: body.name, hasPin: !!body.pin, memberId: null, archived: false, createdAt: new Date().toISOString() }
      this.staff.push(member)
      this.staffCalls.push({ method, body })
      return { status: 201, body: member }
    }
    const staffMember = path.match(/^\/api\/organizations\/[^/]+\/staff\/([^/]+)$/)
    if (staffMember && method === 'PATCH') {
      const member = this.staff.find((s) => s.id === staffMember[1])!
      this.staffCalls.push({ method, body })
      if (body.name !== undefined) member.name = body.name
      if (body.pin !== undefined) member.hasPin = body.pin !== null
      if (body.archived !== undefined) member.archived = body.archived
      return ok(member)
    }
    if (path.startsWith('/api/bancontact/sumup/readers')) return this.sumupRoute(method, path, body)
    if (/^\/api\/organizations\/[^/]+\/events$/.test(path) && method === 'GET') return ok(this.events)
    if (/^\/api\/organizations\/[^/]+\/events$/.test(path) && method === 'POST') {
      if (body.endDate && body.endDate < body.date) return { status: 400, body: { error: 'De laatste dag kan niet voor de eerste dag liggen', code: 'event_end_before_start' } }
      const e = { id: this.id('ev'), name: body.name, date: body.date, endDate: body.endDate || body.date, createdAt: new Date().toISOString(), selfOrder: { enabled: false, code: null }, modes: [], lastOrderNumber: 0 }
      this.events.unshift(e)
      this.eventCalls.push({ path, body })
      return { status: 201, body: e }
    }
    // Deleting one: only while nothing was sold for it (usedEvents: has tabs or sales).
    const oneEvent = path.match(/^\/api\/organizations\/[^/]+\/events\/([^/]+)$/)
    if (oneEvent && method === 'DELETE') {
      if (this.usedEvents.has(oneEvent[1])) return { status: 409, body: { error: 'Dit evenement heeft al rekeningen of verkopen - het blijft bewaard', code: 'event_in_use' } }
      this.events = this.events.filter((e) => e.id !== oneEvent[1])
      return ok({ ok: true })
    }
    // An event's ordering modes, self-ordering and numbers (arcanum-backend events.ts).
    const modeRoute = path.match(/^\/api\/organizations\/[^/]+\/events\/([^/]+)\/modes(?:\/([^/]+))?$/)
    if (modeRoute) {
      const e = this.events.find((x) => x.id === modeRoute[1])
      if (!e) return { status: 404, body: { error: 'Evenement niet gevonden', code: 'event_not_found' } }
      e.modes ??= []
      this.eventCalls.push({ path, body: method === 'DELETE' ? 'DELETE' : body })
      const usable = () => e.modes.some((mode: any) => mode.selfOrder && mode.catalogId)
      if (!modeRoute[2] && method === 'POST') {
        if (!body.name?.trim()) return { status: 400, body: { error: 'Geef de bestelwijze een naam', code: 'order_mode_needs_name' } }
        const catalogId = body.catalogId ?? null
        e.modes.push({ id: this.id('mode'), name: body.name.trim(), catalogId, selfOrder: !!catalogId, payAtCounter: true, payBancontact: false, tabs: false })
        return { status: 201, body: e }
      }
      const index = e.modes.findIndex((mode: any) => mode.id === modeRoute[2])
      if (index < 0) return { status: 404, body: { error: 'Bestelwijze niet gevonden', code: 'order_mode_not_found' } }
      if (method === 'DELETE') e.modes.splice(index, 1)
      if (method === 'PATCH') {
        const mode = e.modes[index]
        if (body.notifySms === true && !e.sms) return { status: 400, body: { error: 'Sms is niet ingesteld voor deze installatie (installer → Geavanceerd → Sms)', code: 'sms_not_configured' } }
        for (const key of ['name', 'catalogId', 'selfOrder', 'payAtCounter', 'payBancontact', 'tabs', 'tabContact', 'notifySms', 'atTable']) if (body[key] !== undefined) mode[key] = body[key]
        if (!mode.catalogId) mode.selfOrder = false
        const to = body.move === 'up' ? index - 1 : body.move === 'down' ? index + 1 : index
        if (to !== index && e.modes[to]) [e.modes[index], e.modes[to]] = [e.modes[to], e.modes[index]]
      }
      if (e.selfOrder?.enabled && !usable()) e.selfOrder.enabled = false
      return ok(e)
    }
    const event = path.match(/^\/api\/organizations\/[^/]+\/events\/([^/]+)(?:\/(self-order-code|reset-numbers))?$/)
    if (event) {
      const e = this.events.find((x) => x.id === event[1])
      if (!e) return { status: 404, body: { error: 'Evenement niet gevonden', code: 'event_not_found' } }
      e.selfOrder ??= { enabled: false, code: null }
      e.modes ??= []
      e.lastOrderNumber ??= 0
      if (!event[2] && method === 'PATCH') {
        // Like the backend: switched on without a mode to order with, one made ready.
        if (body.selfOrderEnabled === true && !e.modes.some((mode: any) => mode.selfOrder && mode.catalogId)) {
          const menu = this.catalogs.find((c: any) => !c.archived)
          if (!menu) return { status: 400, body: { error: 'Maak eerst een menukaart (Menukaarten)', code: 'self_order_needs_catalog' } }
          const withMenu = e.modes.find((mode: any) => mode.catalogId)
          if (withMenu) withMenu.selfOrder = true
          else if (e.modes.length) Object.assign(e.modes[0], { catalogId: menu.id, selfOrder: true })
          else e.modes.push({ id: this.id('mode'), name: 'Ter plaatse', catalogId: menu.id, selfOrder: true, payAtCounter: true, payBancontact: false, tabs: false })
        }
        if (body.selfOrderEnabled !== undefined) e.selfOrder.enabled = body.selfOrderEnabled
        // Its name and days, like the backend (endDate null: one day).
        const date = body.date ?? e.date
        const endDate = body.endDate === undefined ? (e.endDate ?? e.date) : (body.endDate ?? date)
        if (endDate < date) return { status: 400, body: { error: 'De laatste dag kan niet voor de eerste dag liggen', code: 'event_end_before_start' } }
        if (body.name !== undefined) e.name = body.name
        Object.assign(e, { date, endDate })
        if (body.kassaModes !== undefined) e.kassaModes = body.kassaModes
        e.brand ??= { primary: null, accent: null }
        if (body.brandPrimary !== undefined) e.brand.primary = body.brandPrimary
        if (body.brandAccent !== undefined) e.brand.accent = body.brandAccent
        if (e.selfOrder.enabled && !e.selfOrder.code) e.selfOrder.code = `code-${this.id('c')}`
        if (body.linkName !== undefined) {
          const name = String(body.linkName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          e.selfOrder.linkName = name
          e.selfOrder.code = `${name}-${String(this.id('x')).replace(/\D/g, '').padStart(4, 'k')}`
        }
        this.eventCalls.push({ path, body })
        return ok(e)
      }
      if (event[2] === 'self-order-code' && method === 'POST') {
        e.selfOrder.code = `code-${this.id('c')}`
        return ok(e)
      }
      if (event[2] === 'reset-numbers' && method === 'POST') {
        e.lastOrderNumber = 0
        return ok(e)
      }
    }

    const m = path.match(/^\/api\/organizations\/[^/]+\/(catalog|catalogs)(?:\/(.*))?$/)
    if (!m) return { status: 404, body: { error: 'Not found' } }
    const parts = m[2] ? m[2].split('/') : []
    return m[1] === 'catalog' ? this.catalogRoute(method, parts, query, body || {}) : this.catalogsRoute(method, parts, body || {}, query)
  }

  // Toestellen → Toestel toevoegen: codes as the backend makes them. A test
  // "claims" one on a device with claimPairing (the start page's side).
  pairings: { id: string; role: 'pos' | 'cfd' | 'station' | 'tap'; stationId?: string | null; view?: 'pickup' | null; name: string; status: string; code: string; createdAt: string; expiresAt: string; claimedAt: string | null; claimedBy: string | null; terminalId: string | null; createdBy: string; linkTo: string | null; repairs?: string | null }[] = []

  private pairingRoute(method: string, path: string, body: any): FakeResponse {
    const id = path.split('/device-pairings/')[1]
    if (method === 'POST' && !id) {
      const n = this.pairings.length + 1
      const pairing = {
        id: this.id('pair'),
        role: body.role,
        name: body.name,
        status: 'open',
        code: `K7PM-4XQ${n}`,
        createdBy: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        claimedAt: null,
        claimedBy: null,
        terminalId: null,
        linkTo: body.linkTo ?? null,
        stationId: body.stationId ?? null,
        view: body.view ?? null,
        repairs: body.repairs ?? null,
      }
      this.pairings.push(pairing)
      return { status: 201, body: pairing }
    }
    if (method === 'GET' && !id) return ok(this.pairings.map(({ code: _code, ...p }) => p))
    if (method === 'DELETE' && id) {
      const pairing = this.pairings.find((p) => p.id === id && p.status === 'open')
      if (!pairing) return { status: 404, body: { error: 'Not found' } }
      pairing.status = 'revoked'
      return ok({ ok: true })
    }
    return { status: 404, body: { error: 'Not found' } }
  }

  claimPairing(code: string) {
    const pairing = this.pairings.find((p) => p.code === code && p.status === 'open')!
    pairing.status = 'claimed'
    pairing.claimedAt = new Date().toISOString()
    pairing.claimedBy = 'Ann'
    // A re-pair code: the same device, nothing new in the list.
    if (pairing.repairs) {
      pairing.terminalId = pairing.repairs
      return
    }
    pairing.terminalId = `pos-${pairing.id}`
    const station = this.stations.find((s) => s.id === pairing.stationId)
    this.orgDevices.push({
      terminal_id: pairing.terminalId,
      role: pairing.role,
      linked_to: pairing.linkTo,
      created_at: pairing.claimedAt,
      online: true,
      name: pairing.name,
      ...(station ? { station_id: station.id, station_name: station.name, view: pairing.view ?? null } : {}),
    })
  }

  private sumupRoute(method: string, path: string, body: any): FakeResponse {
    if (method === 'GET') return ok(this.sumupReaders ? { configured: true, readers: this.sumupReaders } : { configured: false, readers: [] })
    this.sumupCalls.push({ method, path, body })
    if (!this.sumupReaders) return { status: 409, body: { error: 'x', code: 'sumup_not_configured' } }
    if (method === 'POST') {
      if (this.pairError) {
        const detail = this.pairError
        this.pairError = null
        return { status: 502, body: { error: detail, code: 'sumup_pair_failed', params: { detail } } }
      }
      const reader = { id: this.id('rdr'), name: body.name || 'Solo', status: 'processing', model: 'virtual-solo' }
      this.sumupReaders.push(reader)
      return { status: 201, body: { reader } }
    }
    const id = decodeURIComponent(path.split('/').pop()!)
    this.sumupReaders = this.sumupReaders.filter((r) => r.id !== id)
    return ok({ ok: true })
  }

  // --- /catalog/{categories,stations,products,variants} ---

  private catalogRoute(method: string, [kind, id, sub]: string[], query: string, body: any): FakeResponse {
    if (kind === 'categories' && !id) {
      if (method === 'GET') return ok([...this.categories].sort((a, b) => a.position - b.position))
      const name = trimmed(body.name, 60)
      if (!name) return bad('name is required (max 60 characters)')
      const category = { id: this.id('cat'), name, position: this.categories.length }
      this.categories.push(category)
      return created(category)
    }
    if (kind === 'categories' && id) {
      const category = this.categories.find((c) => c.id === id)
      if (!category) return notFound('Categorie niet gevonden')
      if (method === 'PATCH') {
        if (body.name !== undefined) category.name = trimmed(body.name, 60) || category.name
        return ok(category)
      }
      if (this.products.some((p) => p.categoryId === id)) return conflict('Deze categorie wordt nog gebruikt door producten')
      this.categories = this.categories.filter((c) => c !== category)
      return ok({ ok: true })
    }
    if (kind === 'stations' && !id) {
      if (method === 'GET') return ok([...this.stations].sort((a, b) => a.position - b.position))
      const name = trimmed(body.name, 60)
      if (!name) return bad('name is required (max 60 characters)')
      if (this.stationNamed(name)) return conflict('Er bestaat al een station met deze naam')
      const station = { id: this.id('station'), name, position: this.stations.length }
      this.stations.push(station)
      return created(station)
    }
    if (kind === 'stations' && id) {
      const station = this.stations.find((c) => c.id === id)
      if (!station) return notFound('Station niet gevonden')
      if (method === 'PATCH') {
        if (body.name !== undefined) {
          const name = trimmed(body.name, 60)
          if (!name) return bad('name is required (max 60 characters)')
          const other = this.stationNamed(name)
          if (other && other !== station) return conflict('Er bestaat al een station met deze naam')
          station.name = name
        }
        return ok(station)
      }
      if (this.products.some((p) => p.prepStationId === id)) return conflict('Dit station wordt nog gebruikt door producten')
      this.stations = this.stations.filter((c) => c !== station)
      return ok({ ok: true })
    }
    if (kind === 'products' && !id) {
      if (method === 'GET') {
        const all = query.includes('includeArchived')
        return ok(this.products.filter((p) => all || !p.archived).map((p) => this.productJson(p)))
      }
      const name = trimmed(body.name, 100)
      if (!name) return bad('name is required (max 100 characters)')
      const variants: { name?: string; code?: string | null }[] = body.variants?.length ? body.variants : [{ name: '' }]
      for (const v of variants) if (v.code && this.codeTaken(v.code)) return conflict('Deze code wordt al gebruikt')
      if (body.prepStationId && !this.stations.some((x) => x.id === body.prepStationId)) return bad('Onbekend station')
      const product = {
        id: this.id('prod'),
        name,
        categoryId: body.categoryId ?? null,
        prepStationId: body.prepStationId ?? null,
        vatRateBp: body.vatRateBp ?? null,
        archived: false,
      }
      this.products.push(product)
      variants.forEach((v, i) =>
        this.variants.push({ id: this.id('var'), productId: product.id, name: (v.name || '').trim(), code: v.code || null, position: i, archived: false })
      )
      return created(this.productJson(product))
    }
    if (kind === 'products' && id && !sub) {
      const product = this.products.find((p) => p.id === id)
      if (!product) return notFound('Product niet gevonden')
      if (body.name !== undefined) product.name = trimmed(body.name, 100) || product.name
      if (body.categoryId !== undefined) product.categoryId = body.categoryId
      if (body.prepStationId !== undefined) {
        if (body.prepStationId && !this.stations.some((x) => x.id === body.prepStationId)) return bad('Onbekend station')
        product.prepStationId = body.prepStationId
      }
      if (body.vatRateBp !== undefined) product.vatRateBp = body.vatRateBp
      if (body.archived !== undefined) {
        product.archived = !!body.archived
        for (const v of this.variants.filter((x) => x.productId === id)) v.archived = product.archived
      }
      return ok(this.productJson(product))
    }
    if (kind === 'products' && id && sub === 'variants') {
      if (body.code && this.codeTaken(body.code)) return conflict('Deze code wordt al gebruikt')
      const variant = {
        id: this.id('var'),
        productId: id,
        name: (body.name || '').trim(),
        code: body.code || null,
        position: this.variants.filter((v) => v.productId === id).length,
        archived: false,
      }
      this.variants.push(variant)
      return created(variantJson(variant))
    }
    if (kind === 'variants' && id) {
      const variant = this.variants.find((v) => v.id === id)
      if (!variant) return notFound('Variant niet gevonden')
      if (body.code !== undefined && body.code && body.code !== variant.code && this.codeTaken(body.code)) return conflict('Deze code wordt al gebruikt')
      if (body.name !== undefined) variant.name = body.name
      if (body.code !== undefined) variant.code = body.code || null
      if (body.archived === true) {
        const active = this.variants.filter((v) => v.productId === variant.productId && !v.archived)
        if (active.length <= 1) return conflict('Een product heeft minstens één actieve variant nodig - archiveer dan het product')
        variant.archived = true
      }
      if (body.archived === false) variant.archived = false
      return ok(variantJson(variant))
    }
    return notFound('Not found')
  }

  // --- /catalogs ---

  private catalogsRoute(method: string, [catalogId, action, childId]: string[], body: any, query = ''): FakeResponse {
    if (!catalogId) {
      if (method === 'GET') {
        const all = query.includes('includeArchived')
        return ok(
          this.catalogs
            .filter((c) => all || !c.archived)
            .sort((a, b) => Number(a.archived) - Number(b.archived) || Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
            .map((c) => this.summary(c))
        )
      }
      const name = trimmed(body.name, 60)
      if (!name) return bad('name is required (max 60 characters)')
      const catalog = { id: this.id('menu'), name, isDefault: !this.catalogs.some((c) => c.isDefault), archived: false }
      this.catalogs.push(catalog)
      return created(this.detail(catalog))
    }
    if (catalogId === 'import' && method === 'POST') return this.importRoute(body)
    const catalog = this.catalogs.find((c) => c.id === catalogId)
    if (!catalog) return notFound('Menukaart niet gevonden')

    if (action === 'export' && method === 'GET') return ok(this.exportJson(catalog))
    if (!action) {
      if (method === 'GET') return ok(this.detail(catalog))
      catalog.name = trimmed(body.name, 60) || catalog.name
      return ok(this.detail(catalog))
    }
    if (action === 'default') {
      if (catalog.archived) return notFound('Menukaart niet gevonden')
      for (const c of this.catalogs) c.isDefault = c === catalog
      return ok(this.detail(catalog))
    }
    if (action === 'archive') {
      if (catalog.isDefault) return conflict('De standaardmenukaart kan niet gearchiveerd worden - maak eerst een andere standaard')
      catalog.archived = true
      return ok({ ok: true })
    }
    if (action === 'restore') {
      catalog.archived = false
      return ok(this.detail(catalog))
    }
    if (action === 'duplicate') {
      const copy = { id: this.id('menu'), name: trimmed(body.name, 60) || `${catalog.name} (kopie)`, isDefault: false, archived: false }
      this.catalogs.push(copy)
      for (const s of this.sections.filter((x) => x.catalogId === catalog.id)) {
        const newSection = { ...s, id: this.id('sec'), catalogId: copy.id }
        this.sections.push(newSection)
        for (const e of this.entries.filter((x) => x.sectionId === s.id)) {
          this.entries.push({ ...e, id: this.id('entry'), catalogId: copy.id, sectionId: newSection.id })
        }
      }
      return created(this.detail(copy))
    }
    if (action === 'layout') {
      const layout: { id: string; entryIds: string[] }[] = body.sections || []
      const sectionIds = this.sections.filter((s) => s.catalogId === catalog.id).map((s) => s.id)
      const entryIds = this.entries.filter((e) => e.catalogId === catalog.id).map((e) => e.id)
      const given = layout.map((s) => s.id)
      const givenEntries = layout.flatMap((s) => s.entryIds)
      const same = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x))
      if (this.failNextLayout || !same(given, sectionIds) || !same(givenEntries, entryIds)) {
        this.failNextLayout = false
        return bad('De indeling is intussen gewijzigd - herlaad en probeer opnieuw')
      }
      layout.forEach((s, i) => {
        this.sections.find((x) => x.id === s.id)!.position = i
        s.entryIds.forEach((entryId, j) => Object.assign(this.entries.find((e) => e.id === entryId)!, { sectionId: s.id, position: j }))
      })
      return ok(this.detail(catalog))
    }
    if (action === 'sections' && !childId) {
      const name = trimmed(body.name, 60)
      if (!name) return bad('name is required (max 60 characters)')
      const section = { id: this.id('sec'), catalogId: catalog.id, name, position: this.sections.filter((s) => s.catalogId === catalog.id).length }
      this.sections.push(section)
      return created({ ...section, entries: [] })
    }
    if (action === 'sections' && childId) {
      const section = this.sections.find((s) => s.id === childId && s.catalogId === catalog.id)
      if (!section) return notFound('Groep niet gevonden')
      if (method === 'PATCH') {
        if (body.color !== undefined) {
          if (body.color !== null && !GROUP_COLORS.includes(body.color)) return bad('color must be null or one of the palette')
          section.color = body.color
        }
        section.name = trimmed(body.name, 60) || section.name
        return ok({ ok: true })
      }
      this.entries = this.entries.filter((e) => e.sectionId !== section.id)
      this.sections = this.sections.filter((s) => s !== section)
      return ok({ ok: true })
    }
    if (action === 'entries' && !childId) {
      if (!Number.isInteger(body.priceCents) || Math.abs(body.priceCents) > 1_000_000) return bad('priceCents must be an integer between -1000000 and 1000000')
      if (!this.sections.some((s) => s.id === body.sectionId && s.catalogId === catalog.id)) return bad('Onbekende groep voor deze menukaart')
      if (this.entries.some((e) => e.catalogId === catalog.id && e.variantId === body.variantId)) return conflict('Dit product staat al op deze menukaart')
      const entry = {
        id: this.id('entry'),
        catalogId: catalog.id,
        sectionId: body.sectionId,
        variantId: body.variantId,
        priceCents: body.priceCents,
        visible: body.visible !== false,
        position: this.entries.filter((e) => e.sectionId === body.sectionId).length,
        quickQuantities: body.quickQuantities ?? null,
      }
      this.entries.push(entry)
      return created(this.entryJson(entry))
    }
    if (action === 'entries' && childId) {
      const entry = this.entries.find((e) => e.id === childId && e.catalogId === catalog.id)
      if (!entry) return notFound('Lijn niet gevonden')
      if (method === 'DELETE') {
        this.entries = this.entries.filter((e) => e !== entry)
        return ok({ ok: true })
      }
      if (body.priceCents !== undefined) {
        if (!Number.isInteger(body.priceCents) || Math.abs(body.priceCents) > 1_000_000) return bad('priceCents must be an integer between -1000000 and 1000000')
        entry.priceCents = body.priceCents
      }
      if (body.visible !== undefined) entry.visible = !!body.visible
      if (body.quickQuantities !== undefined) entry.quickQuantities = body.quickQuantities
      return ok(this.entryJson(entry))
    }
    return notFound('Not found')
  }

  // --- Import / export (simplified version of the backend's rules) ---

  private exportJson(c: Catalog) {
    const rows = this.detail(c).sections.flatMap((s) =>
      s.entries
        .filter((e) => e.sellable)
        .map((e) => {
          const product = this.products.find((p) => p.id === e.productId)!
          return {
            groep: s.name,
            product: e.productName,
            variant: e.variantName,
            prijsCents: e.priceCents,
            categorie: e.categoryName,
            station: this.stations.find((x) => x.id === product.prepStationId)?.name ?? null,
            btwBp: product.vatRateBp,
            code: e.code,
            snelknoppen: e.quickQuantities,
            zichtbaar: e.visible,
          }
        })
    )
    return { catalog: { id: c.id, name: c.name }, rows }
  }

  private importRoute(body: any): FakeResponse {
    this.importRequests.push(body)
    const rows: any[] = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0 || rows.length > 500) return bad('rows must be 1-500 rows')
    const target = body.catalogId ? this.catalogs.find((c) => c.id === body.catalogId && !c.archived) : null
    if (body.catalogId && !target) return notFound('Menukaart niet gevonden')
    if (!body.catalogId && !trimmed(body.name, 60)) return bad('name is required (max 60 characters)')

    const errors: { row: number | null; message: string }[] = []
    const lines: { groep: string; product: string; variant: string; priceCents: number; categorie: string | null; station: string | null; visible: boolean }[] = []
    let groep: string | null = null
    let productName: string | null = null
    for (const r of rows) {
      const text = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null)
      groep = text(r.groep) ?? groep
      productName = text(r.product) ?? productName
      const price = typeof r.prijs === 'number' ? r.prijs : parseFloat(String(r.prijs ?? '').replace(/[€\s]/g, '').replace(',', '.'))
      if (!groep) errors.push({ row: r.row, message: 'Groep ontbreekt' })
      if (!productName) errors.push({ row: r.row, message: 'Product ontbreekt' })
      if (!Number.isFinite(price) || price < 0) errors.push({ row: r.row, message: 'Prijs ontbreekt of is ongeldig' })
      const zichtbaar = text(r.zichtbaar)?.toLowerCase()
      if (zichtbaar && !['ja', 'nee', 'x', 'true', 'false', '1', '0'].includes(zichtbaar)) errors.push({ row: r.row, message: `Zichtbaar "${r.zichtbaar}" moet ja of nee zijn` })
      if (groep && productName && Number.isFinite(price)) {
        lines.push({
          groep,
          product: productName,
          variant: text(r.variant) ?? '',
          priceCents: Math.round(price * 100),
          categorie: text(r.categorie),
          station: text(r.station),
          visible: !['nee', 'false', '0'].includes(zichtbaar ?? ''),
        })
      }
    }

    const findProduct = (name: string) => this.products.find((p) => p.name.toLowerCase() === name.toLowerCase())
    const findVariant = (productId: string, name: string) => this.variants.find((v) => v.productId === productId && v.name.toLowerCase() === name.toLowerCase())
    const displayName = (l: { product: string; variant: string }) => (l.variant ? `${l.product} (${l.variant})` : l.product)
    const current = target ? this.entries.filter((e) => e.catalogId === target.id).map((e) => this.entryJson(e)) : []

    const summary = {
      rows: rows.length,
      groups: new Set(lines.map((l) => l.groep)).size,
      newCategories: [...new Set(lines.map((l) => l.categorie).filter((c): c is string => !!c && !this.categories.some((x) => x.name.toLowerCase() === c.toLowerCase())))],
      newStations: [...new Set(lines.map((l) => l.station).filter((c): c is string => !!c && !this.stationNamed(c)))],
      newProducts: [...new Set(lines.filter((l) => !findProduct(l.product)).map((l) => l.product))],
      newVariants: lines.filter((l) => findProduct(l.product) && !findVariant(findProduct(l.product)!.id, l.variant)).map(displayName),
      updatedProducts: [] as { name: string; changes: string[] }[],
      priceChanges: [] as { name: string; fromCents: number; toCents: number }[],
      added: [] as string[],
      removed: [] as string[],
      unchanged: 0,
    }
    for (const l of lines) {
      const existing = current.find((e) => e.displayName.toLowerCase() === displayName(l).toLowerCase())
      if (!existing) summary.added.push(displayName(l))
      else if (existing.priceCents !== l.priceCents) summary.priceChanges.push({ name: displayName(l), fromCents: existing.priceCents, toCents: l.priceCents })
      else summary.unchanged++
    }
    summary.removed = current.filter((e) => !lines.some((l) => displayName(l).toLowerCase() === e.displayName.toLowerCase())).map((e) => e.displayName)
    // Station on an existing product: empty = unchanged, a different name = a change.
    for (const l of lines) {
      const product = findProduct(l.product)
      if (!product || !l.station) continue
      const from = this.stations.find((x) => x.id === product.prepStationId)?.name ?? null
      if (from?.toLowerCase() === l.station.toLowerCase() || summary.updatedProducts.some((u) => u.name === product.name)) continue
      summary.updatedProducts.push({ name: product.name, changes: [`station: ${from ?? '(geen)'} → ${l.station}`] })
    }

    // Like the backend: no summary while the file has errors.
    const result = { ok: errors.length === 0, errors, summary: errors.length === 0 ? summary : null }
    if (body.dryRun) return ok(result)
    if (errors.length > 0) return { status: 400, body: result }

    // Apply: create what's missing, then replace the menukaart's layout.
    const catalog = target ?? { id: this.id('menu'), name: trimmed(body.name, 60), isDefault: !this.catalogs.some((c) => c.isDefault), archived: false }
    if (!target) this.catalogs.push(catalog)
    this.entries = this.entries.filter((e) => e.catalogId !== catalog.id)
    this.sections = this.sections.filter((s) => s.catalogId !== catalog.id)
    for (const l of lines) {
      let category = l.categorie ? this.categories.find((c) => c.name.toLowerCase() === l.categorie!.toLowerCase()) : undefined
      if (l.categorie && !category) {
        category = { id: this.id('cat'), name: l.categorie, position: this.categories.length }
        this.categories.push(category)
      }
      let station = l.station ? this.stationNamed(l.station) : undefined
      if (l.station && !station) {
        station = { id: this.id('station'), name: l.station, position: this.stations.length }
        this.stations.push(station)
      }
      let product = findProduct(l.product)
      if (!product) {
        product = { id: this.id('prod'), name: l.product, categoryId: category?.id ?? null, prepStationId: station?.id ?? null, vatRateBp: null, archived: false }
        this.products.push(product)
      } else if (station) product.prepStationId = station.id
      let variant = findVariant(product.id, l.variant)
      if (!variant) {
        variant = { id: this.id('var'), productId: product.id, name: l.variant, code: null, position: this.variants.filter((v) => v.productId === product!.id).length, archived: false }
        this.variants.push(variant)
      }
      let section = this.sections.find((s) => s.catalogId === catalog.id && s.name === l.groep)
      if (!section) {
        section = { id: this.id('sec'), catalogId: catalog.id, name: l.groep, position: this.sections.filter((s) => s.catalogId === catalog.id).length }
        this.sections.push(section)
      }
      this.entries.push({
        id: this.id('entry'),
        catalogId: catalog.id,
        sectionId: section.id,
        variantId: variant.id,
        priceCents: l.priceCents,
        visible: l.visible,
        position: this.entries.filter((e) => e.sectionId === section!.id).length,
        quickQuantities: null,
      })
    }
    return ok({ ...result, catalog: { id: catalog.id, name: catalog.name } })
  }

  // --- Shapes, as the real backend returns them ---

  private stationNamed(name: string) {
    return this.stations.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
  }

  private codeTaken(code: string) {
    return this.variants.some((v) => v.code === code && !v.archived)
  }

  private productJson(p: Product) {
    return {
      ...p,
      variants: this.variants
        .filter((v) => v.productId === p.id)
        .sort((a, b) => a.position - b.position)
        .map(variantJson),
    }
  }

  private summary(c: Catalog) {
    return {
      id: c.id,
      name: c.name,
      isDefault: c.isDefault,
      archived: c.archived,
      entryCount: this.entries.filter((e) => e.catalogId === c.id).length,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }
  }

  private detail(c: Catalog) {
    return {
      ...this.summary(c),
      sections: this.sections
        .filter((s) => s.catalogId === c.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
          color: s.color ?? null,
          entries: this.entries
            .filter((e) => e.sectionId === s.id)
            .sort((a, b) => a.position - b.position)
            .map((e) => this.entryJson(e)),
        })),
    }
  }

  private entryJson(e: Entry) {
    const variant = this.variants.find((v) => v.id === e.variantId)!
    const product = this.products.find((p) => p.id === variant.productId)!
    const category = this.categories.find((c) => c.id === product.categoryId)
    return {
      id: e.id,
      sectionId: e.sectionId,
      variantId: e.variantId,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      displayName: variant.name ? `${product.name} (${variant.name})` : product.name,
      code: variant.code,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      priceCents: e.priceCents,
      visible: e.visible,
      position: e.position,
      quickQuantities: e.quickQuantities,
      sellable: !variant.archived && !product.archived,
    }
  }
}

function variantJson(v: Variant) {
  return { id: v.id, name: v.name, code: v.code, position: v.position, archived: v.archived }
}

function trimmed(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length <= max ? s : ''
}

const ok = (body: unknown): FakeResponse => ({ status: 200, body })
const created = (body: unknown): FakeResponse => ({ status: 201, body })
const bad = (error: string): FakeResponse => ({ status: 400, body: { error } })
const notFound = (error: string): FakeResponse => ({ status: 404, body: { error } })
const conflict = (error: string): FakeResponse => ({ status: 409, body: { error } })
