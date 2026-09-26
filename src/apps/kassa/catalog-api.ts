// The kassa's read-only view of arcanum-backend's catalogs (see
// arcanum-backend/src/catalog.ts): the compact "kassa" shape of one
// catalog — only visible entries of sellable products — and the org's
// catalog list for the device's Menukaart setting.

export interface KassaEntry {
  entryId: string
  variantId: string
  name: string
  priceCents: number
  code: string | null
  categoryName: string | null
  quickQuantities: number[] | null
}

export interface KassaCatalog {
  id: string
  name: string
  updatedAt: string
  sections: { id: string; name: string; entries: KassaEntry[] }[]
}

export interface CatalogSummary {
  id: string
  name: string
  isDefault: boolean
}

// null = no such catalog (none yet for the org, or it's archived) — the
// API's 404. Any other failure throws.
export async function fetchKassaCatalog(orgId: string, catalogId: string | null): Promise<KassaCatalog | null> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/catalogs/${encodeURIComponent(catalogId || 'default')}/kassa`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Kon menukaart niet laden (${res.status})`)
  return res.json()
}

export async function listCatalogs(orgId: string): Promise<CatalogSummary[]> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/catalogs`)
  if (!res.ok) throw new Error(`Kon menukaarten niet laden (${res.status})`)
  return res.json()
}

export interface KassaEvent {
  id: string
  name: string
  date: string
}

export async function listEvents(orgId: string): Promise<KassaEvent[]> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/events`)
  if (!res.ok) throw new Error(`Kon evenementen niet laden (${res.status})`)
  return res.json()
}
