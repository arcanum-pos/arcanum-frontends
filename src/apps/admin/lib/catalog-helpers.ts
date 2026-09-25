// Pure helpers for the catalog screens (products.tsx, catalogs.tsx,
// catalog-editor.tsx) — kept free of React so they're unit-tested
// (catalog-helpers.test.ts).
import type { CatalogSection, LayoutPayload } from './catalog-api'

// BTW as basis points (2100 = 21%). The rates themselves are placeholders
// until confirmed with an accountant (DOMAIN_MODEL.md: VAT per product).
export const VAT_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Geen', value: null },
  { label: '6%', value: 600 },
  { label: '12%', value: 1200 },
  { label: '21%', value: 2100 },
]

export function vatLabel(value: number | null): string {
  return VAT_OPTIONS.find((o) => o.value === value)?.label ?? `${(value ?? 0) / 100}%`
}

// "2,50" / "2.50" / "€ 2,5" / "3" → cents; null when it isn't a valid,
// non-negative amount with at most two decimals.
export function parseEuroInput(input: string): number | null {
  const cleaned = input.replace(/€/g, '').replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

// Cents → the editable text form, without a currency sign ("2,50").
export function formatEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// "5, 10, 20" → [5, 10, 20]; "" → null (no quick buttons). Returns a
// string error for anything the backend would refuse (1–10 integers
// between 1 and 999).
export function parseQuickQuantities(input: string): number[] | null | { error: string } {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/[,;\s]+/).filter(Boolean)
  const numbers = parts.map((p) => Number(p))
  if (parts.length > 10 || !numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 999)) {
    return { error: 'Snelknoppen: maximaal 10 hele getallen tussen 1 en 999, gescheiden door komma’s' }
  }
  return numbers
}

export function formatQuickQuantities(values: number[] | null): string {
  return values ? values.join(', ') : ''
}

// A copy of `items` with the element at `index` moved by `delta` (−1 up,
// +1 down); unchanged when that would move it out of bounds.
export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

// The full layout PUT body for the sections as they are now.
export function layoutOf(sections: CatalogSection[]): LayoutPayload {
  return { sections: sections.map((s) => ({ id: s.id, entryIds: s.entries.map((e) => e.id) })) }
}

export function moveSectionInLayout(sections: CatalogSection[], sectionIndex: number, delta: number): LayoutPayload {
  return layoutOf(moveItem(sections, sectionIndex, delta))
}

export function moveEntryInLayout(sections: CatalogSection[], sectionId: string, entryIndex: number, delta: number): LayoutPayload {
  return layoutOf(sections.map((s) => (s.id === sectionId ? { ...s, entries: moveItem(s.entries, entryIndex, delta) } : s)))
}

// Variants that could still be added to a catalog: not archived, product
// not archived, and not already on it (a variant appears at most once per
// catalog). Labelled like the backend's display name.
export function addableVariants(
  products: { id: string; name: string; archived: boolean; variants: { id: string; name: string; archived: boolean }[] }[],
  sections: CatalogSection[]
): { variantId: string; label: string }[] {
  const onCatalog = new Set(sections.flatMap((s) => s.entries.map((e) => e.variantId)))
  return products
    .filter((p) => !p.archived)
    .flatMap((p) =>
      p.variants
        .filter((v) => !v.archived && !onCatalog.has(v.id))
        .map((v) => ({ variantId: v.id, label: v.name ? `${p.name} (${v.name})` : p.name }))
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'nl'))
}
