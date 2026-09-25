// Org data export / import — client side of arcanum-backend's
// src/org-transfer.ts. Export is a plain download. Import creates a NEW org
// in browser-driven steps: start → one or more chunks per table (in the
// server's order) → finish. Chunks are idempotent server-side, so a failed
// one is simply retried, and a whole unfinished import can be re-run
// ("Hervatten") against the same org.

export const EXPORT_FORMAT = 'arcanum-org-export'
export const EXPORT_VERSION = 1

export interface ExportFile {
  format: string
  version: number
  exportedAt?: string
  includesSecrets?: boolean
  organization: { name: string; logo_url?: string | null; theme?: string | null; created_at?: string }
  tables: Record<string, Record<string, unknown>[]>
}

export interface Manifest {
  format: string
  version: number
  organization: ExportFile['organization']
  counts: Record<string, number>
}

export type TableReport = Record<string, { expected: number; imported: number }>

// --- Pure helpers ---

// Checks a parsed JSON value is an export this app can import. Everything
// the backend checks again, but failing here means no API call at all.
export function validateExportFile(data: unknown): { ok: true; file: ExportFile } | { ok: false; error: string } {
  const d = data as Partial<ExportFile> | null
  if (!d || typeof d !== 'object' || d.format !== EXPORT_FORMAT) return { ok: false, error: 'Dit is geen Arcanum-exportbestand.' }
  if (d.version !== EXPORT_VERSION) return { ok: false, error: `Exportversie ${String(d.version)} wordt niet ondersteund (verwacht ${EXPORT_VERSION}).` }
  if (!d.organization || typeof d.organization.name !== 'string') return { ok: false, error: 'Het bestand bevat geen organisatie.' }
  if (!d.tables || typeof d.tables !== 'object' || Object.values(d.tables).some((t) => !Array.isArray(t))) {
    return { ok: false, error: 'Het bestand is onvolledig of beschadigd (tabellen ontbreken).' }
  }
  return { ok: true, file: d as ExportFile }
}

export function parseExportText(text: string): { ok: true; file: ExportFile } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Dit bestand is geen geldige JSON.' }
  }
  return validateExportFile(data)
}

export function buildManifest(file: ExportFile): Manifest {
  return {
    format: file.format,
    version: file.version,
    organization: file.organization,
    counts: Object.fromEntries(Object.entries(file.tables).map(([table, rows]) => [table, rows.length])),
  }
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('chunk size must be a positive integer')
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks
}

export interface PlannedChunk {
  table: string
  rows: Record<string, unknown>[]
}

// Every chunk to send, in the server's table order; tables the file
// doesn't have (or has empty) are skipped.
export function planChunks(file: ExportFile, tableOrder: string[], maxChunkRows: number): PlannedChunk[] {
  return tableOrder.flatMap((table) => chunkRows(file.tables[table] ?? [], maxChunkRows).map((rows) => ({ table, rows })))
}

export function totalRows(file: ExportFile): number {
  return Object.values(file.tables).reduce((sum, rows) => sum + rows.length, 0)
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.round((done / total) * 100))
}

export function mismatchedTables(report: TableReport): { table: string; expected: number; imported: number }[] {
  return Object.entries(report)
    .filter(([, r]) => r.expected !== r.imported)
    .map(([table, r]) => ({ table, ...r }))
}

// Retries `fn` up to `attempts` times in total, waiting base, 2×base, … in
// between. `sleep` is injectable for tests.
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 500, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastError
}

// `attachment; filename="arcanum-export-x-2026-09-25.json"` → the name.
export function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : fallback
}

// Human-readable table names for the summary and the report.
export const TABLE_LABELS: Record<string, string> = {
  memberships: 'Leden (als uitnodiging)',
  events: 'Evenementen',
  categories: 'Categorieën',
  prep_stations: 'Stations',
  products: 'Producten',
  product_variants: 'Varianten',
  catalogs: 'Menukaarten',
  catalog_sections: 'Groepen',
  catalog_entries: 'Menukaartlijnen',
  org_counters: 'Tellers (rekening-/ticketnummers)',
  tabs: 'Rekeningen',
  orders: 'Bestellingen',
  order_lines: 'Bestellijnen',
  charges: 'Betalingen',
  transactions: 'Transacties',
  mail_provider: 'Mailinstelling',
  payment_provider_credentials: 'Betaalinstellingen (geheim)',
  smtp_credentials: 'SMTP-instellingen (geheim)',
  gmail_api_credentials: 'Gmail API-instellingen (geheim)',
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table
}

// --- API ---

const ORGS = '/api/organizations'

async function postJson(url: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

function apiError(status: number, data: any): Error {
  return new Error(data?.error || `Fout ${status}`)
}

export async function downloadExport(orgId: string, includeSecrets: boolean): Promise<void> {
  const res = await fetch(`${ORGS}/${encodeURIComponent(orgId)}/export${includeSecrets ? '?secrets=1' : ''}`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw apiError(res.status, data)
  }
  const blob = await res.blob()
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), 'arcanum-export.json')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function startImport(manifest: Manifest, name: string): Promise<{ orgId: string; tables: string[]; maxChunkRows: number }> {
  const { status, data } = await postJson(`${ORGS}/import/start`, { manifest, name })
  if (status !== 201) throw apiError(status, data)
  return data
}

export async function sendChunk(orgId: string, table: string, rows: Record<string, unknown>[]): Promise<void> {
  const { status, data } = await postJson(`${ORGS}/${encodeURIComponent(orgId)}/import/chunk`, { table, rows })
  if (status !== 200) throw apiError(status, data)
}

export async function finishImport(orgId: string): Promise<{ ok: boolean; tables: TableReport }> {
  const { status, data } = await postJson(`${ORGS}/${encodeURIComponent(orgId)}/import/finish`)
  if (status === 200 || status === 409) return { ok: !!data?.ok, tables: data?.tables ?? {} }
  throw apiError(status, data)
}

export async function abortImport(orgId: string): Promise<void> {
  const { status, data } = await postJson(`${ORGS}/${encodeURIComponent(orgId)}/import/abort`)
  if (status !== 200) throw apiError(status, data)
}

// Default table order when resuming (no /start response to read it from):
// the same foreign-key order the backend uses.
export const DEFAULT_TABLE_ORDER = Object.keys(TABLE_LABELS)
export const DEFAULT_MAX_CHUNK_ROWS = 2000

export interface RunImportOptions {
  file: ExportFile
  name: string
  // Resume an unfinished import of this org instead of starting a new one.
  orgId?: string
  // When resuming: the order/size the server gave at start, if still known
  // (otherwise the backend's defaults).
  tables?: string[]
  maxChunkRows?: number
  onProgress?: (doneRows: number, totalRows: number) => void
  // Called as soon as the org exists (right after start), so a failure
  // later on can still be retried ("Hervatten") or aborted for that org.
  onStarted?: (orgId: string, tables: string[], maxChunkRows: number) => void
  retry?: Parameters<typeof withRetry>[1]
}

// The whole import: start (unless resuming) → every chunk (each retried) → finish.
export async function runImport({ file, name, orgId, tables, maxChunkRows, onProgress, onStarted, retry }: RunImportOptions): Promise<{ orgId: string; ok: boolean; tables: TableReport }> {
  let targetId = orgId
  let order = tables ?? DEFAULT_TABLE_ORDER
  let maxRows = maxChunkRows ?? DEFAULT_MAX_CHUNK_ROWS
  if (!targetId) {
    const started = await startImport(buildManifest(file), name)
    targetId = started.orgId
    order = started.tables
    maxRows = started.maxChunkRows
  }
  onStarted?.(targetId, order, maxRows)
  const chunks = planChunks(file, order, maxRows)
  const total = chunks.reduce((sum, c) => sum + c.rows.length, 0)
  let done = 0
  onProgress?.(done, total)
  for (const chunk of chunks) {
    await withRetry(() => sendChunk(targetId!, chunk.table, chunk.rows), retry)
    done += chunk.rows.length
    onProgress?.(done, total)
  }
  const result = await finishImport(targetId)
  return { orgId: targetId, ...result }
}
