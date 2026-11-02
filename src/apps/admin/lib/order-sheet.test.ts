import { describe, expect, it } from 'vitest'
import { orderSheetHtml, sheetGroups, sheetPages, type SheetGroup } from './order-sheet'

const TEXTS = { title: 'Restaurant', table: 'Tafel', waiter: 'Ober', date: 'Datum' }
const group = (name: string, n: number): SheetGroup => ({ name, items: Array.from({ length: n }, (_, i) => `${name} ${i + 1}`) })
const entry = (displayName: string, position: number, extra = {}) => ({ displayName, position, visible: true, sellable: true, ...extra }) as any

describe('sheetGroups', () => {
  it("the kassa's groups and items in its order; hidden or no longer sold left out, an empty group too", () => {
    const groups = sheetGroups({
      sections: [
        { id: 's2', name: 'Dessert', position: 2, entries: [entry('Ijs', 1)] },
        { id: 's1', name: 'Eten', position: 1, entries: [entry('Frieten', 2), entry('Spaghetti', 1), entry('Weg', 3, { visible: false }), entry('Oud', 4, { sellable: false })] },
        { id: 's3', name: 'Leeg', position: 3, entries: [entry('Verborgen', 1, { visible: false })] },
      ] as any,
    })
    expect(groups).toEqual([
      { name: 'Eten', items: ['Spaghetti', 'Frieten'] },
      { name: 'Dessert', items: ['Ijs'] },
    ])
  })
})

describe('sheetPages', () => {
  it('a short menu: one wide column on one page', () => {
    const { columns, pages } = sheetPages([group('Eten', 6), group('Drank', 8)])
    expect(columns).toBe(1)
    expect(pages).toHaveLength(1)
    expect(pages[0][0].map((b) => b.items.length)).toEqual([6, 8])
  })

  it('a longer one: two columns, a group going on in the next under its heading again', () => {
    const { columns, pages } = sheetPages([group('Eten', 12), group('Drank', 14)])
    expect(columns).toBe(2)
    expect(pages).toHaveLength(1)
    const [left, right] = pages[0]
    expect(left.map((b) => b.heading)).toEqual(['Eten', 'Drank'])
    expect(right.map((b) => b.heading)).toEqual(['Drank'])
    expect([...left, ...right].reduce((n, b) => n + b.items.length, 0)).toBe(26)
  })

  it('a long one: more A5 pages, nothing lost', () => {
    const { pages } = sheetPages([group('A', 30), group('B', 30)])
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flat(2).reduce((n, b) => n + b.items.length, 0)).toBe(60)
  })

  it('an empty menu: one empty page', () => {
    expect(sheetPages([]).pages).toEqual([[[]]])
  })
})

describe('orderSheetHtml', () => {
  it('one A5 page: twice on an A4, each item with a box, no prices', () => {
    const html = orderSheetHtml(TEXTS, [group('Eten', 3)])
    expect(html.match(/class="a4"/g)).toHaveLength(1)
    expect(html.match(/class="a5"/g)).toHaveLength(2)
    expect(html.match(/class="box"/g)).toHaveLength(6)
    expect(html).toContain('@page { size: A4 landscape; margin: 0; }')
    expect(html).toContain('Tafel<span></span>')
    expect(html).not.toContain('€')
  })

  it('two A5 pages: side by side on one A4, numbered', () => {
    const html = orderSheetHtml(TEXTS, [group('A', 30), group('B', 20)])
    expect(html.match(/class="a4"/g)).toHaveLength(1)
    expect(html).toContain('<small>1/2</small>')
    expect(html).toContain('<small>2/2</small>')
  })

  it('escapes names and the title', () => {
    const html = orderSheetHtml({ ...TEXTS, title: '<Fuif>' }, [{ name: 'Bar & co', items: ['"Pils"'] }], 'fr')
    expect(html).toContain('<title>&lt;Fuif&gt;</title>')
    expect(html).toContain('Bar &amp; co')
    expect(html).toContain('&quot;Pils&quot;')
    expect(html).toContain('<html lang="fr">')
  })
})
