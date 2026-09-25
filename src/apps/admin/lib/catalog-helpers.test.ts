import { describe, expect, it } from 'vitest'
import type { CatalogEntry, CatalogSection } from './catalog-api'
import {
  addableVariants,
  formatEuroInput,
  formatQuickQuantities,
  layoutOf,
  moveEntryInLayout,
  moveItem,
  moveSectionInLayout,
  parseEuroInput,
  parseQuickQuantities,
  vatLabel,
} from './catalog-helpers'

function entry(id: string, variantId: string): CatalogEntry {
  return {
    id,
    sectionId: 's',
    variantId,
    productId: 'p',
    productName: id,
    variantName: '',
    displayName: id,
    code: null,
    categoryId: null,
    categoryName: null,
    priceCents: 100,
    visible: true,
    position: 0,
    quickQuantities: null,
    sellable: true,
  }
}

const sections: CatalogSection[] = [
  { id: 'drank', name: 'Drank', position: 0, entries: [entry('pils', 'v-pils'), entry('cola', 'v-cola'), entry('water', 'v-water')] },
  { id: 'eten', name: 'Eten', position: 1, entries: [entry('steak', 'v-steak')] },
]

describe('parseEuroInput', () => {
  it.each([
    ['2,50', 250],
    ['2.50', 250],
    ['2,5', 250],
    ['3', 300],
    ['€ 1,25', 125],
    ['0', 0],
    [' 12,00 ', 1200],
  ])('%s → %i cents', (input, cents) => {
    expect(parseEuroInput(input)).toBe(cents)
  })

  it.each(['', 'abc', '-1', '1,234', '1,2,3', '1.000,00'])('rejects %j', (input) => {
    expect(parseEuroInput(input)).toBeNull()
  })

  it('round-trips with formatEuroInput', () => {
    expect(formatEuroInput(250)).toBe('2,50')
    expect(parseEuroInput(formatEuroInput(1999))).toBe(1999)
  })
})

describe('quick quantities', () => {
  it('parses a comma list, tolerating spaces and semicolons', () => {
    expect(parseQuickQuantities('5, 10,20; 40')).toEqual([5, 10, 20, 40])
  })

  it('treats an empty input as no quick buttons', () => {
    expect(parseQuickQuantities('   ')).toBeNull()
  })

  it.each(['0', '5, x', '1000', '1.5', '1,2,3,4,5,6,7,8,9,10,11'])('rejects %j like the backend would', (input) => {
    expect(parseQuickQuantities(input)).toHaveProperty('error')
  })

  it('formats back to the editable form', () => {
    expect(formatQuickQuantities([5, 10])).toBe('5, 10')
    expect(formatQuickQuantities(null)).toBe('')
  })
})

describe('vatLabel', () => {
  it('labels the known rates and none', () => {
    expect(vatLabel(null)).toBe('Geen')
    expect(vatLabel(2100)).toBe('21%')
    expect(vatLabel(550)).toBe('5.5%')
  })
})

describe('moveItem', () => {
  it('moves up and down without mutating the input', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(items, 1, 1)).toEqual(['a', 'c', 'b'])
    expect(items).toEqual(['a', 'b', 'c'])
  })

  it('leaves the list alone at the edges', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 0, -1)).toBe(items)
    expect(moveItem(items, 1, 1)).toBe(items)
  })
})

describe('layout payloads', () => {
  it('lists every section and entry in their current order', () => {
    expect(layoutOf(sections)).toEqual({
      sections: [
        { id: 'drank', entryIds: ['pils', 'cola', 'water'] },
        { id: 'eten', entryIds: ['steak'] },
      ],
    })
  })

  it('moves a section and keeps its entries', () => {
    expect(moveSectionInLayout(sections, 1, -1).sections.map((s) => s.id)).toEqual(['eten', 'drank'])
  })

  it('moves an entry only within its own section', () => {
    const layout = moveEntryInLayout(sections, 'drank', 2, -1)
    expect(layout.sections).toEqual([
      { id: 'drank', entryIds: ['pils', 'water', 'cola'] },
      { id: 'eten', entryIds: ['steak'] },
    ])
  })
})

describe('addableVariants', () => {
  it('offers active variants not yet on the catalog, labelled like the kassa', () => {
    const products = [
      { id: 'p1', name: 'Pils', archived: false, variants: [{ id: 'v-pils', name: '', archived: false }] },
      {
        id: 'p2',
        name: 'Steak',
        archived: false,
        variants: [
          { id: 'v-steak', name: 'volwassene', archived: false },
          { id: 'v-kind', name: 'kind', archived: false },
          { id: 'v-oud', name: 'oud', archived: true },
        ],
      },
      { id: 'p3', name: 'Archief', archived: true, variants: [{ id: 'v-a', name: '', archived: false }] },
    ]
    expect(addableVariants(products, sections)).toEqual([{ variantId: 'v-kind', label: 'Steak (kind)' }])
  })
})
