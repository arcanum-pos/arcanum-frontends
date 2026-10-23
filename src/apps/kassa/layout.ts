// This till's own arrangement (2026-10-23), kept on the device — screens
// differ, so every kassa has its own:
//  - how wide the tab panel on the right is (the divider can be dragged);
//  - where the menu's groups go when it shows "Alles": in columns, in the
//    order the cashier dragged them to (Indeling aanpassen). Per menu: another
//    menu has other groups. Without one, the groups flow as before.
//  - since 2026-10-24 a row over the whole width above the columns: where a
//    group with "sell N at once" tiles starts (as before), and where any group
//    can be dragged to; such a group can go into a column too.

export interface GroupLayout {
  // Section ids per column, top to bottom.
  columns: string[][]
  // Over the whole width, above the columns, top to bottom. Missing in a
  // layout saved before it existed.
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

export function readLayout(catalogId: string): GroupLayout | null {
  const all = readJson<Record<string, GroupLayout>>(LAYOUT_KEY)
  const layout = all?.[catalogId]
  const ids = (list: unknown) => Array.isArray(list) && list.every((id) => typeof id === 'string')
  return layout && Array.isArray(layout.columns) && layout.columns.every(ids) && (layout.top === undefined || ids(layout.top)) ? layout : null
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
export function placeSections(ids: string[], layout: GroupLayout | null, count: number): string[][] {
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

// The groups in the full-width row and the columns. `full`: the groups that
// start in the row (those with tiles) when the layout doesn't place them yet.
export function placeGroups(ids: string[], full: Set<string>, layout: GroupLayout | null, count: number): { top: string[]; columns: string[][] } {
  const known = new Set(ids)
  const top = (layout?.top ?? []).filter((id) => known.has(id))
  const placed = new Set([...top, ...(layout?.columns.flat() ?? [])].filter((id) => known.has(id)))
  for (const id of ids) if (!placed.has(id) && full.has(id)) top.push(id)
  const inTop = new Set(top)
  const rest = ids.filter((id) => !inTop.has(id))
  const columns = placeSections(rest, layout ? { columns: layout.columns.map((c) => c.filter((id) => !inTop.has(id))) } : null, count)
  return { top, columns }
}

// A group moved: to column `to`, at `index` there (the end when past it).
export function moveSection(columns: string[][], id: string, to: number, index: number): string[][] {
  const next = columns.map((c) => c.filter((x) => x !== id))
  const target = next[to] ?? (next[next.length] = [])
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id)
  return next
}
