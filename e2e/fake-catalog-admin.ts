// In-memory stand-in for arcanum-backend's catalog API (src/catalog.ts)
// plus the few calls the console shell makes on load (/whoami, the org
// list) and what the Rapporten page reads (the sales report, the payment
// list, events) — those three just return whatever a test put in
// `salesReport` / `transactions` / `events`. The catalog part enforces the
// same rules and returns the same status codes and Dutch messages as the
// real backend, so the console's error handling is exercised — the
// backend's own rules are tested for real in arcanum-backend's suite.
export interface FakeResponse {
  status: number
  body: unknown
}

interface Category {
  id: string
  name: string
  position: number
}
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
  reportQueries: { from: string; to: string }[] = []
  transactions: any[] = []
  events: any[] = []
  // Every import call (dry run or apply) as received — tests assert on the
  // raw rows the browser sent.
  importRequests: any[] = []
  private seq = 0

  private id(prefix: string) {
    return `${prefix}-${++this.seq}`
  }

  handle(method: string, fullPath: string, body: any): FakeResponse {
    const [path, query = ''] = fullPath.split('?')
    if (path === '/whoami') return ok({ sub: 'admin', email: 'admin@e2e.test', name: 'Admin', firstName: 'Admin', lastName: '', username: 'admin' })
    if (path === '/api/organizations' && method === 'GET') {
      return ok([{ id: ORG_ID, name: 'E2E', logoUrl: null, theme: null, createdAt: '2026-01-01', customDomain: null }])
    }

    if (/^\/api\/organizations\/[^/]+\/reports\/sales$/.test(path) && method === 'GET') {
      const params = new URLSearchParams(query)
      const range = { from: params.get('from') || '', to: params.get('to') || '' }
      this.reportQueries.push(range)
      if (this.reportStatus === 403) return { status: 403, body: { error: 'Forbidden' } }
      return ok({ ...this.salesReport, ...range })
    }
    if (path === '/api/bancontact/transactions' && method === 'GET') return ok(this.transactions)
    if (/^\/api\/organizations\/[^/]+\/events$/.test(path) && method === 'GET') return ok(this.events)

    const m = path.match(/^\/api\/organizations\/[^/]+\/(catalog|catalogs)(?:\/(.*))?$/)
    if (!m) return { status: 404, body: { error: 'Not found' } }
    const parts = m[2] ? m[2].split('/') : []
    return m[1] === 'catalog' ? this.catalogRoute(method, parts, query, body || {}) : this.catalogsRoute(method, parts, body || {})
  }

  // --- /catalog/{categories,products,variants} ---

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
    if (kind === 'products' && !id) {
      if (method === 'GET') {
        const all = query.includes('includeArchived')
        return ok(this.products.filter((p) => all || !p.archived).map((p) => this.productJson(p)))
      }
      const name = trimmed(body.name, 100)
      if (!name) return bad('name is required (max 100 characters)')
      const variants: { name?: string; code?: string | null }[] = body.variants?.length ? body.variants : [{ name: '' }]
      for (const v of variants) if (v.code && this.codeTaken(v.code)) return conflict('Deze code wordt al gebruikt')
      const product = { id: this.id('prod'), name, categoryId: body.categoryId ?? null, vatRateBp: body.vatRateBp ?? null, archived: false }
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
        if (active.length <= 1) return conflict('Een product heeft minstens één actieve variant nodig — archiveer dan het product')
        variant.archived = true
      }
      if (body.archived === false) variant.archived = false
      return ok(variantJson(variant))
    }
    return notFound('Not found')
  }

  // --- /catalogs ---

  private catalogsRoute(method: string, [catalogId, action, childId]: string[], body: any): FakeResponse {
    if (!catalogId) {
      if (method === 'GET') {
        return ok(
          this.catalogs
            .filter((c) => !c.archived)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
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
      if (catalog.isDefault) return conflict('De standaardmenukaart kan niet gearchiveerd worden — maak eerst een andere standaard')
      catalog.archived = true
      return ok({ ok: true })
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
        return bad('De indeling is intussen gewijzigd — herlaad en probeer opnieuw')
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
        section.name = trimmed(body.name, 60) || section.name
        return ok({ ok: true })
      }
      this.entries = this.entries.filter((e) => e.sectionId !== section.id)
      this.sections = this.sections.filter((s) => s !== section)
      return ok({ ok: true })
    }
    if (action === 'entries' && !childId) {
      if (!Number.isInteger(body.priceCents) || body.priceCents < 0) return bad('priceCents must be an integer between 0 and 1000000')
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
        if (!Number.isInteger(body.priceCents) || body.priceCents < 0) return bad('priceCents must be an integer between 0 and 1000000')
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
    if (rows.length === 0 || rows.length > 500) return bad('rows must be 1–500 rows')
    const target = body.catalogId ? this.catalogs.find((c) => c.id === body.catalogId && !c.archived) : null
    if (body.catalogId && !target) return notFound('Menukaart niet gevonden')
    if (!body.catalogId && !trimmed(body.name, 60)) return bad('name is required (max 60 characters)')

    const errors: { row: number | null; message: string }[] = []
    const lines: { groep: string; product: string; variant: string; priceCents: number; categorie: string | null; visible: boolean }[] = []
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
        lines.push({ groep, product: productName, variant: text(r.variant) ?? '', priceCents: Math.round(price * 100), categorie: text(r.categorie), visible: !['nee', 'false', '0'].includes(zichtbaar ?? '') })
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

    const result = { ok: errors.length === 0, errors, summary }
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
      let product = findProduct(l.product)
      if (!product) {
        product = { id: this.id('prod'), name: l.product, categoryId: category?.id ?? null, vatRateBp: null, archived: false }
        this.products.push(product)
      }
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
