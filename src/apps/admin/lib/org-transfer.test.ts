import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildManifest,
  chunkRows,
  DEFAULT_TABLE_ORDER,
  filenameFromDisposition,
  mismatchedTables,
  parseExportText,
  planChunks,
  progressPercent,
  runImport,
  totalRows,
  validateExportFile,
  withRetry,
  type ExportFile,
} from './org-transfer'

function file(tables: Record<string, Record<string, unknown>[]> = {}): ExportFile {
  return { format: 'arcanum-org-export', version: 1, includesSecrets: false, organization: { name: 'Scouts' }, tables }
}

describe('validateExportFile / parseExportText', () => {
  it('accepts a version 1 export', () => {
    expect(validateExportFile(file({ products: [] })).ok).toBe(true)
  })

  it('rejects other formats, versions and broken files with a readable reason', () => {
    const reason = (data: unknown) => {
      const r = validateExportFile(data)
      return r.ok ? null : r.error
    }
    expect(reason(null)).toMatch(/geen Arcanum-exportbestand/)
    expect(reason({ ...file(), format: 'menukaart' })).toMatch(/geen Arcanum-exportbestand/)
    expect(reason({ ...file(), version: 2 })).toMatch(/versie 2/)
    expect(reason({ ...file(), organization: undefined })).toMatch(/geen organisatie/)
    expect(reason({ ...file(), tables: { products: 'x' } })).toMatch(/onvolledig/)
  })

  it('reports invalid JSON', () => {
    const r = parseExportText('{nope')
    expect(r.ok).toBe(false)
    expect(parseExportText(JSON.stringify(file())).ok).toBe(true)
  })
})

describe('manifest, chunking and progress', () => {
  const f = file({ products: [{ id: 1 }, { id: 2 }, { id: 3 }], categories: [{ id: 'c' }], events: [] })

  it('builds the manifest counts from the file', () => {
    expect(buildManifest(f)).toEqual({
      format: 'arcanum-org-export',
      version: 1,
      organization: { name: 'Scouts' },
      counts: { products: 3, categories: 1, events: 0 },
    })
  })

  it('chunks rows by the maximum size', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunkRows([], 2)).toEqual([])
    expect(() => chunkRows([1], 0)).toThrow()
  })

  it("plans chunks in the server's table order and skips empty or missing tables", () => {
    const plan = planChunks(f, ['categories', 'products', 'events', 'tabs'], 2)
    expect(plan.map((c) => [c.table, c.rows.length])).toEqual([
      ['categories', 1],
      ['products', 2],
      ['products', 1],
    ])
    expect(totalRows(f)).toBe(4)
  })

  it('calculates progress, treating an empty import as done', () => {
    expect(progressPercent(0, 4)).toBe(0)
    expect(progressPercent(1, 3)).toBe(33)
    expect(progressPercent(5, 4)).toBe(100)
    expect(progressPercent(0, 0)).toBe(100)
  })

  it('lists only the tables whose counts differ', () => {
    expect(
      mismatchedTables({ products: { expected: 2, imported: 2 }, tabs: { expected: 5, imported: 3 } })
    ).toEqual([{ table: 'tabs', expected: 5, imported: 3 }])
  })

  it('knows the backend table order for resuming', () => {
    expect(DEFAULT_TABLE_ORDER.slice(0, 5)).toEqual(['memberships', 'events', 'categories', 'prep_stations', 'products'])
    expect(DEFAULT_TABLE_ORDER.indexOf('order_lines')).toBeGreaterThan(DEFAULT_TABLE_ORDER.indexOf('orders'))
  })
})

describe('withRetry', () => {
  afterEach(() => vi.useRealTimers())

  it('retries with exponential backoff and returns the first success', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 3) throw new Error('tijdelijk')
      return 'ok'
    })
    const promise = withRetry(fn, { attempts: 3, baseDelayMs: 100 })
    await vi.advanceTimersByTimeAsync(99)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('gives up after the last attempt with the last error', async () => {
    const sleep = vi.fn(async () => {})
    await expect(withRetry(async () => Promise.reject(new Error('stuk')), { attempts: 3, baseDelayMs: 10, sleep })).rejects.toThrow('stuk')
    expect(sleep.mock.calls).toEqual([[10], [20]])
  })
})

describe('filenameFromDisposition', () => {
  it("keeps the server's filename, with a fallback", () => {
    expect(filenameFromDisposition('attachment; filename="arcanum-export-scouts-2026-09-25.json"', 'x.json')).toBe('arcanum-export-scouts-2026-09-25.json')
    expect(filenameFromDisposition(null, 'x.json')).toBe('x.json')
  })
})

describe('runImport', () => {
  afterEach(() => vi.unstubAllGlobals())

  function fakeFetch(handler: (url: string, body: any) => { status: number; body: unknown }) {
    const calls: { url: string; body: any }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        calls.push({ url, body })
        const r = handler(url, body)
        return new Response(JSON.stringify(r.body), { status: r.status })
      })
    )
    return calls
  }

  it('starts, sends every chunk in order, reports progress and finishes', async () => {
    const calls = fakeFetch((url) => {
      if (url.endsWith('/import/start')) return { status: 201, body: { orgId: 'new', tables: ['categories', 'products'], maxChunkRows: 2 } }
      if (url.endsWith('/import/finish')) return { status: 200, body: { ok: true, tables: { products: { expected: 3, imported: 3 } } } }
      return { status: 200, body: { ok: true } }
    })
    const progress: [number, number][] = []
    const result = await runImport({
      file: file({ products: [{ id: 1 }, { id: 2 }, { id: 3 }], categories: [{ id: 'c' }] }),
      name: 'Kopie',
      onProgress: (d, t) => progress.push([d, t]),
    })
    expect(result).toEqual({ orgId: 'new', ok: true, tables: { products: { expected: 3, imported: 3 } } })
    expect(calls[0].body).toMatchObject({ name: 'Kopie', manifest: { counts: { products: 3, categories: 1 } } })
    expect(calls.slice(1, -1).map((c) => [c.body.table, c.body.rows.length])).toEqual([
      ['categories', 1],
      ['products', 2],
      ['products', 1],
    ])
    expect(progress).toEqual([
      [0, 4],
      [1, 4],
      [3, 4],
      [4, 4],
    ])
  })

  it('resumes an existing org without calling start', async () => {
    const calls = fakeFetch((url) => (url.endsWith('/import/finish') ? { status: 409, body: { ok: false, tables: { tabs: { expected: 1, imported: 0 } } } } : { status: 200, body: { ok: true } }))
    const result = await runImport({ file: file({ tabs: [{ id: 't' }] }), name: 'x', orgId: 'half' })
    expect(calls.some((c) => c.url.endsWith('/import/start'))).toBe(false)
    expect(calls[0].url).toBe('/api/organizations/half/import/chunk')
    expect(result.ok).toBe(false)
  })

  it('retries a failing chunk and fails after the attempts run out', async () => {
    let chunkCalls = 0
    fakeFetch((url) => {
      if (url.endsWith('/import/start')) return { status: 201, body: { orgId: 'new', tables: ['products'], maxChunkRows: 10 } }
      if (url.endsWith('/chunk')) {
        chunkCalls++
        return { status: 500, body: { error: 'D1 onbereikbaar' } }
      }
      return { status: 200, body: { ok: true, tables: {} } }
    })
    await expect(runImport({ file: file({ products: [{ id: 1 }] }), name: 'x', retry: { attempts: 3, baseDelayMs: 0 } })).rejects.toThrow('D1 onbereikbaar')
    expect(chunkCalls).toBe(3)
  })
})
