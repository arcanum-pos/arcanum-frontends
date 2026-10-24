import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clampPanel, columnsThatFit, flatColumns, moveSection, placeRows, placeSections, unflatColumns, readLayout, readPanelWidth, writeLayout, writePanelWidth } from './layout'

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

describe('placeRows', () => {
  const full = new Set(['bon'])
  it('without a layout: the groups with tiles in a full-width row, the rest in columns below', () => {
    expect(placeRows(['bon', 'a', 'b', 'c'], full, null, 2)).toEqual([[['bon']], [['a', 'c'], ['b']]])
    expect(placeRows(['a', 'b'], full, null, 2)).toEqual([[['a'], ['b']]])
  })
  it('a saved one is kept as it is, empty rows and columns included (room on purpose)', () => {
    expect(placeRows(['bon', 'a', 'b'], full, { rows: [[['a'], []], [['bon', 'b']], [[]]] }, 2)).toEqual([[['a'], []], [['bon', 'b']], [[]]])
  })
  it('a new tile group at the top of the first column, another in the shortest column of the last row; gone ones left out', () => {
    expect(placeRows(['bon', 'a', 'new'], full, { rows: [[['a']], [['gone'], []]] }, 2)).toEqual([[['bon', 'a']], [['new'], []]])
  })
  it('never without a row and a column', () => {
    expect(placeRows(['a'], full, { rows: [] }, 2)).toEqual([[['a']]])
    expect(placeRows(['a'], full, { rows: [[]] }, 2)).toEqual([[['a']]])
  })
  it('the columns of all rows in one list for dragging, and back', () => {
    const rows = [[['bon']], [['a'], ['b', 'c']]]
    expect(flatColumns(rows)).toEqual([['bon'], ['a'], ['b', 'c']])
    expect(unflatColumns(rows, [[], ['a', 'bon'], ['b', 'c']])).toEqual([[[]], [['a', 'bon'], ['b', 'c']]])
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
    writeLayout('cat-1', { rows: [[['a'], ['b']]] })
    writeLayout('cat-2', { rows: [[['x']]] })
    expect(readLayout('cat-1')).toEqual({ rows: [[['a'], ['b']]] })
    writeLayout('cat-1', null)
    expect(readLayout('cat-1')).toBeNull()
    expect(readLayout('cat-2')).toEqual({ rows: [[['x']]] })
    writePanelWidth(480)
    expect(readPanelWidth()).toBe(480)
    writePanelWidth(null)
    expect(readPanelWidth()).toBeNull()
  })
  it('reads a layout saved before rows existed: its full-width row (if any), then its columns', () => {
    localStorage.setItem('arcanum-kassa-layout', JSON.stringify({ a: { columns: [['x'], ['y']] }, b: { top: ['bon'], columns: [['x'], []] }, c: { top: [], columns: [['x']] } }))
    expect(readLayout('a')).toEqual({ rows: [[['x'], ['y']]] })
    expect(readLayout('b')).toEqual({ rows: [[['bon']], [['x'], []]] })
    expect(readLayout('c')).toEqual({ rows: [[['x']]] })
  })
  it('ignores what isn\'t a layout', () => {
    localStorage.setItem('arcanum-kassa-layout', JSON.stringify({ 'cat-1': { columns: 'nope' } }))
    expect(readLayout('cat-1')).toBeNull()
  })
})
