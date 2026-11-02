// The order sheet on paper (2026-11-02): one per table, where the waiter
// keeps a tally per item (marks in fives) and the cashier types it in at
// the end. The menu's groups and items in the kassa's order (as the kassa
// shows it before a device rearranges it), no prices (the table has its
// own menu card). A5: two on an A4 (landscape), cut or folded in half; a
// menu that needs two A5 pages fills the A4 with both. Printed like the
// table QR codes (qr-sheet.ts): a plain document of its own, paginated here.
import type { CatalogDetail } from './catalog-api'

export interface SheetGroup {
  name: string
  items: string[]
}

// A column's pieces: a group heading (repeated when a group goes on in the
// next column) and its items.
export interface SheetBlock {
  heading: string
  items: string[]
}
export type SheetPage = SheetBlock[][]

export interface SheetTexts {
  title: string
  table: string
  waiter: string
  date: string
}

// Millimetres on an A5 page: 8 margin, the header, and what's left for the
// columns. A row is the tally box plus the gap under it.
const BODY_MM = 210 - 2 * 8 - 26
export const ROW_MM = 9
export const HEADING_MM = 8

// What the kassa sells from this menu: visible, sellable items, in its order.
export function sheetGroups(catalog: Pick<CatalogDetail, 'sections'>): SheetGroup[] {
  return [...catalog.sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      name: s.name,
      items: [...s.entries]
        .filter((e) => e.visible && e.sellable)
        .sort((a, b) => a.position - b.position)
        .map((e) => e.displayName),
    }))
    .filter((g) => g.items.length > 0)
}

// One wide column when it all fits, else two narrower ones; then as many
// A5 pages as needed. A group may go on in the next column, under its
// heading again.
export function sheetPages(groups: SheetGroup[]): { columns: 1 | 2; pages: SheetPage[] } {
  const total = groups.reduce((mm, g) => mm + HEADING_MM + g.items.length * ROW_MM, 0)
  const columns: 1 | 2 = total <= BODY_MM ? 1 : 2
  const pages: SheetPage[] = []
  let page: SheetPage = []
  let column: SheetBlock[] = []
  let used = 0
  const nextColumn = () => {
    page.push(column)
    column = []
    used = 0
    if (page.length === columns) {
      pages.push(page)
      page = []
    }
  }
  for (const group of groups) {
    let block: SheetBlock | null = null
    for (const item of group.items) {
      const need = ROW_MM + (block ? 0 : HEADING_MM)
      if (used + need > BODY_MM && used > 0) {
        nextColumn()
        block = null
      }
      if (!block) {
        block = { heading: group.name, items: [] }
        column.push(block)
        used += HEADING_MM
      }
      block.items.push(item)
      used += ROW_MM
    }
  }
  if (column.length) nextColumn()
  if (page.length) pages.push(page)
  return { columns, pages: pages.length ? pages : [[[]]] }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const STYLE = `
@page { size: A4 landscape; margin: 0; }
html, body { margin: 0; background: #fff; color: #000; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.a4 { display: flex; width: 297mm; height: 210mm; overflow: hidden; }
.a4 + .a4 { break-before: page; }
.a5 { box-sizing: border-box; width: 148.5mm; height: 210mm; padding: 8mm; display: flex; flex-direction: column; overflow: hidden; }
.a5 + .a5 { border-left: 0.2mm dashed #888; }
.head { height: 26mm; flex: none; display: flex; flex-direction: column; gap: 3mm; }
.title { display: flex; justify-content: space-between; align-items: baseline; font-size: 14pt; font-weight: 700; }
.title small { font-size: 8pt; font-weight: 400; }
.fields { display: flex; gap: 4mm; font-size: 9pt; }
.field { flex: 1; display: flex; align-items: flex-end; gap: 1.5mm; }
.field span { flex: 1; border-bottom: 0.3mm solid #000; height: 6mm; }
.cols { flex: 1; display: flex; gap: 6mm; min-height: 0; }
.col { flex: 1; min-width: 0; }
.group { height: ${HEADING_MM}mm; box-sizing: border-box; display: flex; align-items: flex-end; padding-bottom: 1mm; font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
.row { height: ${ROW_MM}mm; display: flex; align-items: center; gap: 2mm; }
.name { font-size: 9.5pt; line-height: 1.1; max-height: 7.5mm; overflow: hidden; }
.one .name { width: 48mm; }
.two .name { width: 26mm; }
.box { flex: 1; height: 7.5mm; box-sizing: border-box; border: 0.3mm solid #000; border-radius: 1mm; }
`

function a5(texts: SheetTexts, page: SheetPage, columns: 1 | 2, n: number, of: number): string {
  const head = `<div class="head"><div class="title">${esc(texts.title)}${of > 1 ? `<small>${n}/${of}</small>` : ''}</div><div class="fields">${[texts.table, texts.waiter, texts.date]
    .map((f) => `<div class="field">${esc(f)}<span></span></div>`)
    .join('')}</div></div>`
  const col = (blocks: SheetBlock[]) =>
    `<div class="col">${blocks
      .map((b) => `<div class="group">${esc(b.heading)}</div>${b.items.map((i) => `<div class="row"><div class="name">${esc(i)}</div><div class="box"></div></div>`).join('')}`)
      .join('')}</div>`
  const cols = Array.from({ length: columns }, (_, i) => col(page[i] ?? []))
  return `<div class="a5">${head}<div class="cols ${columns === 1 ? 'one' : 'two'}">${cols.join('')}</div></div>`
}

export function orderSheetHtml(texts: SheetTexts, groups: SheetGroup[], lang = 'nl'): string {
  const { columns, pages } = sheetPages(groups)
  const halves = pages.map((p, i) => a5(texts, p, columns, i + 1, pages.length))
  // One page: twice on the A4. More: side by side, in order.
  const a4s: string[][] = []
  if (halves.length === 1) a4s.push([halves[0], halves[0]])
  else for (let i = 0; i < halves.length; i += 2) a4s.push(halves.slice(i, i + 2))
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(texts.title)}</title><style>${STYLE}</style></head><body>${a4s
    .map((h) => `<div class="a4">${h.join('')}</div>`)
    .join('')}</body></html>`
}
