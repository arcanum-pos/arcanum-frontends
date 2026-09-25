// Client for arcanum-backend's catalog API (src/catalog.ts): categories,
// stations, products + variants (org-level) and catalogs (menukaarten) with
// sections (groepen) and priced entries. Three separate ideas: a Groep is
// where a button sits on the kassa (per menukaart), a Categorie is what a
// product is (reports), a Station is who prepares it (bar, keuken). Reads are open to any member, every write
// is admin-only — a cashier just gets the server's 403 back as an error.
import { request } from './api'
import type { ExportRow, ImportRow } from './menu-sheet'

export interface Category {
  id: string
  name: string
  position: number
}

// Who prepares a product (Bar, Keuken, CoffeeCorner). Optional per product:
// none = nothing to prepare (bonnen, inschrijvingen).
export interface Station {
  id: string
  name: string
  position: number
}

export interface Variant {
  id: string
  name: string
  code: string | null
  position: number
  archived: boolean
}

export interface Product {
  id: string
  name: string
  categoryId: string | null
  prepStationId: string | null
  vatRateBp: number | null
  archived: boolean
  variants: Variant[]
}

export interface CatalogSummary {
  id: string
  name: string
  isDefault: boolean
  archived: boolean
  entryCount: number
  createdAt: string
  updatedAt: string
}

export interface CatalogEntry {
  id: string
  sectionId: string
  variantId: string
  productId: string
  productName: string
  variantName: string
  displayName: string
  code: string | null
  categoryId: string | null
  categoryName: string | null
  priceCents: number
  visible: boolean
  position: number
  quickQuantities: number[] | null
  // False once the product or variant is archived — still listed so it can
  // be removed, but the kassa never shows it.
  sellable: boolean
}

export interface CatalogSection {
  id: string
  name: string
  position: number
  entries: CatalogEntry[]
}

export interface CatalogDetail extends CatalogSummary {
  sections: CatalogSection[]
}

const org = (orgId: string) => `/${encodeURIComponent(orgId)}`
const id = (value: string) => encodeURIComponent(value)
const body = (value: unknown) => JSON.stringify(value)

// --- Categories ---

export function listCategories(orgId: string): Promise<Category[]> {
  return request(`${org(orgId)}/catalog/categories`)
}

export function createCategory(orgId: string, name: string): Promise<Category> {
  return request(`${org(orgId)}/catalog/categories`, { method: 'POST', body: body({ name }) })
}

export function updateCategory(orgId: string, categoryId: string, fields: { name?: string; position?: number }): Promise<Category> {
  return request(`${org(orgId)}/catalog/categories/${id(categoryId)}`, { method: 'PATCH', body: body(fields) })
}

export function deleteCategory(orgId: string, categoryId: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalog/categories/${id(categoryId)}`, { method: 'DELETE' })
}

// --- Stations ---

export function listStations(orgId: string): Promise<Station[]> {
  return request(`${org(orgId)}/catalog/stations`)
}

export function createStation(orgId: string, name: string): Promise<Station> {
  return request(`${org(orgId)}/catalog/stations`, { method: 'POST', body: body({ name }) })
}

export function updateStation(orgId: string, stationId: string, fields: { name?: string; position?: number }): Promise<Station> {
  return request(`${org(orgId)}/catalog/stations/${id(stationId)}`, { method: 'PATCH', body: body(fields) })
}

export function deleteStation(orgId: string, stationId: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalog/stations/${id(stationId)}`, { method: 'DELETE' })
}

// --- Products & variants ---

export function listProducts(orgId: string, includeArchived = false): Promise<Product[]> {
  return request(`${org(orgId)}/catalog/products${includeArchived ? '?includeArchived=1' : ''}`)
}

export function createProduct(
  orgId: string,
  fields: {
    name: string
    categoryId: string | null
    prepStationId: string | null
    vatRateBp: number | null
    variants: { name: string; code: string | null }[]
  }
): Promise<Product> {
  return request(`${org(orgId)}/catalog/products`, { method: 'POST', body: body(fields) })
}

export function updateProduct(
  orgId: string,
  productId: string,
  fields: { name?: string; categoryId?: string | null; prepStationId?: string | null; vatRateBp?: number | null; archived?: boolean }
): Promise<Product> {
  return request(`${org(orgId)}/catalog/products/${id(productId)}`, { method: 'PATCH', body: body(fields) })
}

export function createVariant(orgId: string, productId: string, fields: { name: string; code: string | null }): Promise<Variant> {
  return request(`${org(orgId)}/catalog/products/${id(productId)}/variants`, { method: 'POST', body: body(fields) })
}

export function updateVariant(
  orgId: string,
  variantId: string,
  fields: { name?: string; code?: string | null; archived?: boolean }
): Promise<Variant> {
  return request(`${org(orgId)}/catalog/variants/${id(variantId)}`, { method: 'PATCH', body: body(fields) })
}

// --- Catalogs ---

export function listCatalogs(orgId: string): Promise<CatalogSummary[]> {
  return request(`${org(orgId)}/catalogs`)
}

export function getCatalog(orgId: string, catalogId: string): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}`)
}

export function createCatalog(orgId: string, name: string): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs`, { method: 'POST', body: body({ name }) })
}

export function renameCatalog(orgId: string, catalogId: string, name: string): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}`, { method: 'PATCH', body: body({ name }) })
}

export function duplicateCatalog(orgId: string, catalogId: string, name: string): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/duplicate`, { method: 'POST', body: body({ name }) })
}

export function setDefaultCatalog(orgId: string, catalogId: string): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/default`, { method: 'POST' })
}

export function archiveCatalog(orgId: string, catalogId: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/archive`, { method: 'POST' })
}

export interface LayoutPayload {
  sections: { id: string; entryIds: string[] }[]
}

export function setCatalogLayout(orgId: string, catalogId: string, layout: LayoutPayload): Promise<CatalogDetail> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/layout`, { method: 'PUT', body: body(layout) })
}

export function createSection(orgId: string, catalogId: string, name: string): Promise<CatalogSection> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/sections`, { method: 'POST', body: body({ name }) })
}

export function renameSection(orgId: string, catalogId: string, sectionId: string, name: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/sections/${id(sectionId)}`, { method: 'PATCH', body: body({ name }) })
}

export function deleteSection(orgId: string, catalogId: string, sectionId: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/sections/${id(sectionId)}`, { method: 'DELETE' })
}

export function createEntry(
  orgId: string,
  catalogId: string,
  fields: { sectionId: string; variantId: string; priceCents: number; visible?: boolean; quickQuantities?: number[] | null }
): Promise<CatalogEntry> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/entries`, { method: 'POST', body: body(fields) })
}

export function updateEntry(
  orgId: string,
  catalogId: string,
  entryId: string,
  fields: { priceCents?: number; visible?: boolean; quickQuantities?: number[] | null; sectionId?: string }
): Promise<CatalogEntry> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/entries/${id(entryId)}`, { method: 'PATCH', body: body(fields) })
}

export function deleteEntry(orgId: string, catalogId: string, entryId: string): Promise<{ ok: true }> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/entries/${id(entryId)}`, { method: 'DELETE' })
}

// --- Import / export (flat sheet, see menu-sheet.ts) ---

export interface CatalogExport {
  catalog: { id: string; name: string }
  rows: ExportRow[]
}

export function exportCatalog(orgId: string, catalogId: string): Promise<CatalogExport> {
  return request(`${org(orgId)}/catalogs/${id(catalogId)}/export`)
}

export interface ImportSummary {
  rows: number
  groups: number
  newCategories: string[]
  // Optional: absent from a backend that predates stations.
  newStations?: string[]
  newProducts: string[]
  // Variants added to products that already exist (a new product's
  // variants are covered by newProducts).
  newVariants: string[]
  updatedProducts: { name: string; changes: string[] }[]
  priceChanges: { name: string; fromCents: number; toCents: number }[]
  added: string[]
  removed: string[]
  unchanged: number
}

export interface ImportResult {
  ok: boolean
  errors: { row: number | null; message: string }[]
  // null when the file has errors (nothing to summarize yet).
  summary: ImportSummary | null
  catalog?: { id: string; name: string }
}

// Dry run (preview) or apply. `catalogId` replaces that menukaart; without
// it, `name` creates a new one. A 400 carrying the import result shape
// (ok: false, errors per row) is returned, not thrown, so the preview can
// show the errors; any other failure throws like request() does.
export async function importCatalog(
  orgId: string,
  fields: { catalogId?: string; name?: string; dryRun: boolean; rows: ImportRow[] }
): Promise<ImportResult> {
  const res = await fetch(`/api/organizations${org(orgId)}/catalogs/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body(fields),
  })
  const data = await res.json().catch(() => null)
  if (data && Array.isArray(data.errors) && typeof data.ok === 'boolean') return data as ImportResult
  if (!res.ok) throw new Error((data && data.error) || `status ${res.status}`)
  return data as ImportResult
}
