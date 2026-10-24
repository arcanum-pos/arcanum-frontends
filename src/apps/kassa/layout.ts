// This till's own arrangement (2026-10-23), kept on the device — screens
// differ, so every kassa has its own:
//  - how wide the tab panel on the right is (the divider can be dragged);
//  - where the menu's groups go when it shows "Alles": in columns, in the
//    order the cashier dragged them to (Indeling aanpassen). Per menu: another
//    menu has other groups. Without one, the groups flow as before.
//  - since 2026-10-24 in rows, each with its own columns (one column: the
//    whole width). A group with "sell N at once" tiles starts in a row of its
//    own above the others; every group can go into any row and column. Rows
//    and columns are added and removed by hand: an empty column stays (room on
//    purpose) until the cashier removes it.

// Group ids per column, columns per row, top to bottom and left to right.
export type Rows = string[][][]

export interface GroupLayout {
  rows: Rows
}

// Saved before rows existed: one full-width row (`top`), then the columns.
interface OldLayout {
  columns: string[][]
  top?: string[]
}

const LAYOUT_KEY = 'arcanum-kassa-layout'
const WIDTH_KEY = 'arcanum-kassa-panel-width'

export const PANEL_DEFAULT = 412
export const PANEL_MIN = 340
// Never so wide that the menu has no room left.
export const panelMax = (viewport: number) => Math.max(PANEL_MIN, Math.min(760, Math.round(viewport * 0.55)))
export const clampPanel = (width: number, viewport: number) => Math.round(Math.min(panelMax(viewport), Math.max(PANEL_MIN, width)))

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private mode / storage full: the arrangement lasts until the page reloads
  }
}

export function readPanelWidth(): number | null {
  const width = readJson<number>(WIDTH_KEY)
  return typeof width === 'number' && Number.isFinite(width) ? width : null
}

export function writePanelWidth(width: number | null) {
  writeJson(WIDTH_KEY, width)
}

const isIds = (list: unknown): list is string[] => Array.isArray(list) && list.every((id) => typeof id === 'string')

export function readLayout(catalogId: string): GroupLayout | null {
  const all = readJson<Record<string, unknown>>(LAYOUT_KEY)
  const layout = all?.[catalogId] as Partial<GroupLayout & OldLayout> | undefined
  if (!layout) return null
  if (Array.isArray(layout.rows) && layout.rows.every((r) => Array.isArray(r) && r.every(isIds))) return { rows: layout.rows }
  if (Array.isArray(layout.columns) && layout.columns.every(isIds) && (layout.top === undefined || isIds(layout.top))) {
    // One full-width row (if it held anything), then the columns.
    return { rows: [...(layout.top?.length ? [[layout.top]] : []), layout.columns] }
  }
  return null
}

export function writeLayout(catalogId: string, layout: GroupLayout | null) {
  const all = readJson<Record<string, GroupLayout>>(LAYOUT_KEY) ?? {}
  if (layout) all[catalogId] = layout
  else delete all[catalogId]
  writeJson(LAYOUT_KEY, Object.keys(all).length ? all : null)
}

// How many columns fit, as the automatic flow does (cards of at least 300 px, 12 px apart).
export const columnsThatFit = (width: number) => Math.max(1, Math.floor((width + 12) / 312))

// The groups in columns: a saved arrangement, kept to the menu as it is now
// (a group that's gone is left out, a new one goes to the shortest column);
// without one, the order the automatic flow shows them in (row by row).
export function placeSections(ids: string[], layout: { columns: string[][] } | null, count: number): string[][] {
  if (!layout) {
    const columns: string[][] = Array.from({ length: Math.max(1, count) }, () => [])
    ids.forEach((id, i) => columns[i % columns.length].push(id))
    return columns
  }
  const known = new Set(ids)
  const columns = layout.columns.map((c) => c.filter((id) => known.has(id)))
  if (columns.length === 0) columns.push([])
  const placed = new Set(columns.flat())
  for (const id of ids) {
    if (placed.has(id)) continue
    const shortest = columns.reduce((best, c, i) => (c.length < columns[best].length ? i : best), 0)
    columns[shortest].push(id)
  }
  return columns
}

// The groups in rows of columns. Without a layout: the groups with tiles
// (`full`) in a full-width row of their own, the others in as many columns as
// fit. With one, kept to the menu as it is now: gone groups left out (their
// rows and columns stay, empty), a new one with tiles at the top of the first
// column, any other in the shortest column of the last row.
export function placeRows(ids: string[], full: Set<string>, layout: GroupLayout | null, count: number): Rows {
  if (!layout) {
    const tiles = ids.filter((id) => full.has(id))
    const rest = ids.filter((id) => !full.has(id))
    const rows: Rows = []
    if (tiles.length) rows.push([tiles])
    if (rest.length || !rows.length) rows.push(placeSections(rest, null, count))
    return rows
  }
  const known = new Set(ids)
  const rows: Rows = layout.rows.map((r) => r.map((c) => c.filter((id) => known.has(id))))
  if (rows.length === 0) rows.push([[]])
  for (const r of rows) if (r.length === 0) r.push([])
  const placed = new Set(rows.flat(2))
  const last = rows[rows.length - 1]
  for (const id of ids) {
    if (placed.has(id)) continue
    if (full.has(id)) rows[0][0].unshift(id)
    else last.reduce((best, c) => (c.length < best.length ? c : best), last[0]).push(id)
  }
  return rows
}

// The columns of every row in one list (what dragging works on), and back.
export const flatColumns = (rows: Rows) => rows.flat(1)
export function unflatColumns(rows: Rows, columns: string[][]): Rows {
  let i = 0
  return rows.map((r) => r.map(() => columns[i++]))
}

// A group moved: to column `to`, at `index` there (the end when past it).
export function moveSection(columns: string[][], id: string, to: number, index: number): string[][] {
  const next = columns.map((c) => c.filter((x) => x !== id))
  const target = next[to] ?? (next[next.length] = [])
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id)
  return next
}
