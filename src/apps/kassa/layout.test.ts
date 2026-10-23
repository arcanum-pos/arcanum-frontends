import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clampPanel, columnsThatFit, moveSection, placeGroups, placeSections, readLayout, readPanelWidth, writeLayout, writePanelWidth } from './layout'

describe('placeSections', () => {
  it('without an arrangement: row by row, like the automatic flow', () => {
    expect(placeSections(['a', 'b', 'c', 'd', 'e'], null, 2)).toEqual([['a', 'c', 'e'], ['b', 'd']])
    expect(placeSections(['a'], null, 0)).toEqual([['a']])
  })
  it('a saved one, kept to the menu: gone groups left out, new ones to the shortest column', () => {
    expect(placeSections(['a', 'b', 'c', 'new'], { columns: [['c', 'gone', 'a'], ['b']] }, 3)).toEqual([['c', 'a'], ['b', 'new']])
    expect(placeSections(['a'], { columns: [] }, 2)).toEqual([['a']])
  })
})

describe('placeGroups', () => {
  const full = new Set(['bon'])
  it('without a layout: groups with tiles in the full-width row, the rest in columns', () => {
    expect(placeGroups(['bon', 'a', 'b', 'c'], full, null, 2)).toEqual({ top: ['bon'], columns: [['a', 'c'], ['b']] })
  })
  it('a layout from before the row existed: the tile group goes to the row, the columns stay', () => {
    expect(placeGroups(['bon', 'a', 'b'], full, { columns: [['b'], ['a']] }, 2)).toEqual({ top: ['bon'], columns: [['b'], ['a']] })
  })
  it('a tile group dragged into a column stays there; a plain group can be in the row', () => {
    expect(placeGroups(['bon', 'a', 'b'], full, { top: ['a'], columns: [['b', 'bon'], []] }, 2)).toEqual({ top: ['a'], columns: [['b', 'bon'], []] })
  })
  it('a new plain group goes to the shortest column, a new tile group to the row; gone ones are left out', () => {
    expect(placeGroups(['bon', 'a', 'new'], full, { top: ['gone'], columns: [['a'], []] }, 2)).toEqual({ top: ['bon'], columns: [['a'], ['new']] })
  })
})

describe('moveSection', () => {
  it('to another column at a place, or to the end; to a new column', () => {
    expect(moveSection([['a', 'b'], ['c']], 'a', 1, 0)).toEqual([['b'], ['a', 'c']])
    expect(moveSection([['a', 'b'], ['c']], 'a', 0, 9)).toEqual([['b', 'a'], ['c']])
    expect(moveSection([['a', 'b']], 'b', 1, 0)).toEqual([['a'], ['b']])
  })
})

describe('the panel width and columns', () => {
  it('stays between its bounds: never so wide the menu has no room', () => {
    expect(clampPanel(200, 1280)).toBe(340)
    expect(clampPanel(500, 1280)).toBe(500)
    expect(clampPanel(900, 1280)).toBe(704)
    expect(clampPanel(900, 1920)).toBe(760)
  })
  it('as many columns as cards of 300 px fit', () => {
    expect(columnsThatFit(600)).toBe(1)
    expect(columnsThatFit(612)).toBe(2)
    expect(columnsThatFit(1300)).toBe(4)
  })
})

describe('kept on the device, per menu', () => {
  beforeEach(() => {
    const stored: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored[k] ?? null,
      setItem: (k: string, v: string) => (stored[k] = v),
      removeItem: (k: string) => delete stored[k],
    })
  })
  it('a layout per menu; the width once; cleared again', () => {
    writeLayout('cat-1', { columns: [['a'], ['b']] })
    writeLayout('cat-2', { columns: [['x']] })
    expect(readLayout('cat-1')).toEqual({ columns: [['a'], ['b']] })
    writeLayout('cat-1', null)
    expect(readLayout('cat-1')).toBeNull()
    expect(readLayout('cat-2')).toEqual({ columns: [['x']] })
    writePanelWidth(480)
    expect(readPanelWidth()).toBe(480)
    writePanelWidth(null)
    expect(readPanelWidth()).toBeNull()
  })
  it('ignores what isn\'t a layout', () => {
    localStorage.setItem('arcanum-kassa-layout', JSON.stringify({ 'cat-1': { columns: 'nope' } }))
    expect(readLayout('cat-1')).toBeNull()
  })
})
