// The table QR codes on paper (2026-10-24): a document of their own, printed
// from an invisible frame, not the console restyled for print. Printing the
// console itself (its cards in a CSS grid split over pages) left the tab
// blank and unusable in some browsers while the print dialog was open; this
// one is plain and paginated beforehand, so the browser has nothing to work
// out, and the console never changes.
//
// A4, 12 mm margins: 3 cards across, 4 down (12 a page), 42 mm QR codes.
export const CARDS_PER_PAGE = 12

export interface QrCard {
  name: string
  zone: string | null
  // The QR code's <svg> markup (rendered by qrcode.react on the page).
  svg: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const STYLE = `
@page { size: A4 portrait; margin: 12mm; }
html, body { margin: 0; background: #fff; color: #000; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.page { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6mm; width: 186mm; }
.page + .page { break-before: page; }
.card { box-sizing: border-box; width: 58mm; height: 62mm; border: 0.3mm solid #000; border-radius: 3mm; padding: 4mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; overflow: hidden; }
.card svg { width: 42mm; height: 42mm; flex: none; }
.name { font-size: 14pt; font-weight: 700; line-height: 1.15; text-align: center; }
.zone { font-size: 9pt; line-height: 1.15; text-align: center; }
`

export function qrSheetHtml(title: string, cards: QrCard[], lang = 'nl'): string {
  const pages: QrCard[][] = []
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) pages.push(cards.slice(i, i + CARDS_PER_PAGE))
  const card = (c: QrCard) =>
    `<div class="card">${c.svg}<div class="name">${esc(c.name)}</div>${c.zone ? `<div class="zone">${esc(c.zone)}</div>` : ''}</div>`
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${pages
    .map((p) => `<div class="page">${p.map(card).join('')}</div>`)
    .join('')}</body></html>`
}

// Prints it from `frame` (kept on the page, invisible): written fresh each time.
export function printQrSheet(frame: HTMLIFrameElement, html: string) {
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) return
  doc.open()
  doc.write(html)
  doc.close()
  win.focus()
  win.print()
}
