// In-memory stand-in for arcanum-backend's org export/import
// (src/org-transfer.ts) plus the org list/detail the console shell reads.
// Enforces the same rules the real backend does, so the console's import
// flow is exercised for real: chunks only while an org is importing,
// inserts idempotent by id (retries never double-count), finish compares
// every table's count against the manifest, abort only while importing.
// Returns null for anything it doesn't handle (FakeCatalogAdmin answers
// the rest).
import { ORG_ID, type FakeResponse } from './fake-catalog-admin'

export const TABLE_ORDER = [
  'memberships', 'events', 'categories', 'prep_stations', 'products', 'product_variants', 'catalogs', 'catalog_sections', 'catalog_entries',
  'org_counters', 'tabs', 'orders', 'order_lines', 'charges', 'transactions', 'mail_provider', 'payment_provider_credentials',
  'smtp_credentials', 'gmail_api_credentials',
]

interface FakeOrg {
  id: string
  name: string
  importStatus: string | null
  counts: Record<string, number>
  rows: Map<string, Set<string>>
}

export function exportFile(overrides: Record<string, unknown> = {}) {
  return {
    format: 'arcanum-org-export',
    version: 1,
    exportedAt: '2026-09-25T10:00:00.000Z',
    includesSecrets: false,
    organization: { name: 'Scouts Elewijt', logo_url: null, theme: null, created_at: '2026-01-01T00:00:00.000Z' },
    tables: {
      memberships: [{ id: 'm1', invited_email: 'kok@example.test', role: 'cashier', status: 'active' }],
      categories: [{ id: 'c1', name: 'Drank' }],
      products: [
        { id: 'p1', name: 'Pintje' },
        { id: 'p2', name: 'Duvel' },
        { id: 'p3', name: 'Steak' },
      ],
      tabs: [{ id: 't1', number: 1 }],
      transactions: [
        { id: 'x1', amount_cents: 250 },
        { id: 'x2', amount_cents: 400 },
      ],
    },
    ...overrides,
  }
}

export class FakeOrgTransfer {
  orgs: FakeOrg[] = [{ id: ORG_ID, name: 'E2E', importStatus: null, counts: {}, rows: new Map() }]
  // What an export download returns; exportQueries records each ?query.
  exportBody: unknown = exportFile()
  exportQueries: string[] = []
  // Test knobs: how many rows per chunk the server allows; fail the next N
  // chunk calls with a 500 (a transient error the client should retry);
  // silently drop a table's rows so finish reports a mismatch.
  maxChunkRows = 2
  failNextChunks = 0
  dropTable: string | null = null
  // Every call, in order, for assertions.
  calls: { path: string; body: any; status: number }[] = []
  private seq = 0

  handle(method: string, fullPath: string, body: any): (FakeResponse & { headers?: Record<string, string>; raw?: string }) | null {
    const [path, query = ''] = fullPath.split('?')
    const res = this.route(method, path, query, body)
    if (res) this.calls.push({ path, body, status: res.status })
    return res
  }

  private route(method: string, path: string, query: string, body: any) {
    if (path === '/api/organizations' && method === 'GET') {
      return ok(this.orgs.map((o) => this.orgJson(o)))
    }
    const detail = path.match(/^\/api\/organizations\/([^/]+)$/)
    if (detail && method === 'GET') {
      const org = this.orgs.find((o) => o.id === detail[1])
      return org ? ok(this.orgJson(org)) : { status: 404, body: { error: 'Not found' } }
    }

    const exportMatch = path.match(/^\/api\/organizations\/([^/]+)\/export$/)
    if (exportMatch && method === 'GET') {
      this.exportQueries.push(query)
      return {
        status: 200,
        body: null,
        raw: JSON.stringify({ ...(this.exportBody as object), includesSecrets: query.includes('secrets=1') }),
        headers: { 'Content-Disposition': 'attachment; filename="arcanum-export-e2e-2026-09-25.json"' },
      }
    }

    if (path === '/api/organizations/import/start' && method === 'POST') {
      const manifest = body?.manifest
      if (manifest?.format !== 'arcanum-org-export') return { status: 400, body: { error: 'Dit is geen Arcanum-exportbestand' } }
      if (manifest?.version !== 1) return { status: 400, body: { error: 'Exportversie wordt niet ondersteund' } }
      const org: FakeOrg = {
        id: `org-imported-${++this.seq}`,
        name: body.name || manifest.organization.name,
        importStatus: 'importing',
        counts: manifest.counts,
        rows: new Map(),
      }
      this.orgs.push(org)
      return { status: 201, body: { orgId: org.id, tables: TABLE_ORDER, maxChunkRows: this.maxChunkRows } }
    }

    const step = path.match(/^\/api\/organizations\/([^/]+)\/import\/(chunk|finish|abort)$/)
    if (step && method === 'POST') {
      const org = this.orgs.find((o) => o.id === step[1])
      if (!org) return { status: 404, body: { error: 'Organisatie niet gevonden' } }
      if (org.importStatus !== 'importing') return { status: 409, body: { error: 'Deze organisatie wordt niet (meer) geïmporteerd' } }

      if (step[2] === 'chunk') {
        if (!TABLE_ORDER.includes(body?.table)) return { status: 400, body: { error: 'Onbekende tabel' } }
        if (!Array.isArray(body.rows) || body.rows.length > this.maxChunkRows) return { status: 400, body: { error: 'Te veel rijen per stuk' } }
        if (this.failNextChunks > 0) {
          this.failNextChunks--
          return { status: 500, body: { error: 'Tijdelijke fout' } }
        }
        if (body.table === this.dropTable) return ok({ ok: true, inserted: 0 })
        const set = org.rows.get(body.table) ?? new Set<string>()
        const before = set.size
        for (const row of body.rows) set.add(row.id ?? JSON.stringify(row))
        org.rows.set(body.table, set)
        return ok({ ok: true, inserted: set.size - before })
      }

      if (step[2] === 'finish') {
        const tables = Object.fromEntries(TABLE_ORDER.map((t) => [t, { expected: org.counts[t] ?? 0, imported: org.rows.get(t)?.size ?? 0 }]))
        const allMatch = Object.values(tables).every((r) => r.expected === r.imported)
        if (!allMatch) return { status: 409, body: { ok: false, tables } }
        org.importStatus = null
        return ok({ ok: true, tables })
      }

      this.orgs = this.orgs.filter((o) => o.id !== org.id)
      return ok({ ok: true })
    }
    return null
  }

  // An org left half-imported (the browser closed mid-import).
  addUnfinishedImport(name: string, counts: Record<string, number>): string {
    const id = `org-unfinished-${++this.seq}`
    this.orgs.push({ id, name, importStatus: 'importing', counts, rows: new Map() })
    return id
  }

  private orgJson(o: FakeOrg) {
    return { id: o.id, name: o.name, logoUrl: null, theme: null, createdAt: '2026-01-01', customDomain: null, importStatus: o.importStatus }
  }
}

function ok(body: unknown): FakeResponse {
  return { status: 200, body }
}
