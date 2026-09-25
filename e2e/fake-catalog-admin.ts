// In-memory stand-in for arcanum-backend's catalog API (src/catalog.ts)
// plus the few calls the console shell makes on load (/whoami, the org
// list). Enforces the same rules and returns the same status codes and
// Dutch messages as the real backend, so the console's error handling is
// exercised — the backend's own rules are tested for real in
// arcanum-backend's suite.
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
    const catalog = this.catalogs.find((c) => c.id === catalogId)
    if (!catalog) return notFound('Menukaart niet gevonden')

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
