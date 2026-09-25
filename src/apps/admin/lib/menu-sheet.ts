// Menukaart import/export as a flat sheet — pure logic, no spreadsheet
// library (that lives in menu-files.ts and is lazy-loaded). See
// DOMAIN_MODEL.md "Menukaart import/export": one file = one menukaart, one
// row = one kassa button.
//
// Import sends the cells *raw* (as read from the sheet) to the backend,
// which does all interpretation (fill-down of Groep/Product, "€ 8,50",
// "21%", ja/nee, …). This side only finds the header, maps the columns,
// drops fully empty rows and keeps the real sheet row numbers so the
// backend's errors point at the right row.

export const COLUMNS = [
  { key: 'groep', header: 'Groep', required: true },
  { key: 'product', header: 'Product', required: true },
  { key: 'variant', header: 'Variant', required: false },
  { key: 'prijs', header: 'Prijs', required: true },
  { key: 'categorie', header: 'Categorie', required: false },
  // Optional so files from before stations existed still import.
  { key: 'station', header: 'Station', required: false },
  { key: 'btw', header: 'BTW', required: false },
  { key: 'code', header: 'Code', required: false },
  { key: 'snelknoppen', header: 'Snelknoppen', required: false },
  { key: 'zichtbaar', header: 'Zichtbaar', required: false },
] as const

export type ColumnKey = (typeof COLUMNS)[number]['key']
export const HEADERS: string[] = COLUMNS.map((c) => c.header)
export const MAX_IMPORT_ROWS = 500

export type RawCell = string | number | boolean | null

export type ImportRow = { row: number } & Record<ColumnKey, RawCell>

export interface ParsedSheet {
  // Missing required headers or too many rows — don't call the backend.
  errors: string[]
  // Header cells that aren't one of the known columns (ignored, shown as a notice).
  ignoredHeaders: string[]
  rows: ImportRow[]
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

// A cell as the backend wants it: string | number | boolean | null. Dates
// (a cell Excel decided was a date) become an ISO string so the backend can
// reject them with a row number instead of the browser crashing.
function rawCell(value: unknown): RawCell {
  if (isEmpty(value)) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

// `cells[i]` is sheet row i + 1 (both readers keep empty rows in place).
export function parseSheetRows(cells: unknown[][]): ParsedSheet {
  const headerIndex = cells.findIndex((row) => Array.isArray(row) && row.some((c) => !isEmpty(c)))
  if (headerIndex === -1) return { errors: ['Het bestand is leeg.'], ignoredHeaders: [], rows: [] }

  const header = cells[headerIndex]
  const positions = new Map<ColumnKey, number>()
  const ignoredHeaders: string[] = []
  header.forEach((cell, i) => {
    if (isEmpty(cell)) return
    const column = COLUMNS.find((c) => normalizeHeader(c.header) === normalizeHeader(cell))
    if (column && !positions.has(column.key)) positions.set(column.key, i)
    else ignoredHeaders.push(String(cell).trim())
  })

  const missing = COLUMNS.filter((c) => c.required && !positions.has(c.key)).map((c) => c.header)
  if (missing.length > 0) {
    return {
      errors: [`Verplichte kolom${missing.length > 1 ? 'men' : ''} ontbreekt: ${missing.join(', ')}. De eerste niet-lege rij moet de kolomnamen bevatten.`],
      ignoredHeaders,
      rows: [],
    }
  }

  const rows: ImportRow[] = []
  for (let i = headerIndex + 1; i < cells.length; i++) {
    const source = cells[i] || []
    const row = { row: i + 1 } as ImportRow
    let anyValue = false
    for (const column of COLUMNS) {
      const position = positions.get(column.key)
      const value = position === undefined ? null : rawCell(source[position])
      row[column.key] = value
      if (value !== null) anyValue = true
    }
    if (anyValue) rows.push(row)
  }

  const errors: string[] = []
  if (rows.length === 0) errors.push('Geen rijen gevonden onder de kolomnamen.')
  if (rows.length > MAX_IMPORT_ROWS) errors.push(`Maximaal ${MAX_IMPORT_ROWS} rijen per menukaart (dit bestand heeft er ${rows.length}).`)
  return { errors, ignoredHeaders, rows }
}

// --- CSV ---

// Belgian Excel writes `;`-separated CSV (the comma is the decimal
// separator); others write `,`. The delimiter is whichever of `;`, `,` or
// tab occurs most in the first line outside quotes.
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let quoted = false
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch in counts) counts[ch]++
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return count > 0 ? best : ';'
}

// RFC 4180-style: quoted fields may contain the delimiter, newlines and
// doubled quotes. A leading UTF-8 BOM is dropped. Every row is kept (also
// empty lines) so array index + 1 = file line number, like the xlsx reader.
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// `;`-separated with a UTF-8 BOM, so Belgian Excel opens it with the right
// columns and characters (é, €) straight away.
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n'
}

// --- Export ---

export interface ExportRow {
  groep: string
  product: string
  variant: string
  prijsCents: number
  categorie: string | null
  station: string | null
  btwBp: number | null
  code: string | null
  snelknoppen: number[] | null
  zichtbaar: boolean
}

// One sheet row in column order. Prijs stays a number (euros) so Excel can
// calculate with it; BTW is a plain percentage number (21, not 0.21).
export function exportRowCells(row: ExportRow): (string | number)[] {
  return [
    row.groep,
    row.product,
    row.variant,
    row.prijsCents / 100,
    row.categorie ?? '',
    row.station ?? '',
    row.btwBp === null ? '' : row.btwBp / 100,
    row.code ?? '',
    row.snelknoppen?.length ? row.snelknoppen.join(', ') : '',
    row.zichtbaar ? 'ja' : 'nee',
  ]
}

function csvNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}

// Prijs with a decimal comma and two decimals ("8,50"), like Belgian Excel.
export function exportCsvRows(rows: ExportRow[]): string[][] {
  return [
    HEADERS,
    ...rows.map((row) =>
      exportRowCells(row).map((cell, i) => {
        if (typeof cell !== 'number') return cell
        return COLUMNS[i].key === 'prijs' ? cell.toFixed(2).replace('.', ',') : csvNumber(cell)
      })
    ),
  ]
}

export const TEMPLATE_ROWS: ExportRow[] = [
  { groep: 'Drank', product: 'Pintje', variant: '', prijsCents: 250, categorie: 'Drank', station: 'Bar', btwBp: null, code: null, snelknoppen: null, zichtbaar: true },
  { groep: 'Eten', product: 'Steak', variant: 'volwassene', prijsCents: 1800, categorie: 'Eten', station: 'Keuken', btwBp: null, code: null, snelknoppen: null, zichtbaar: true },
  { groep: 'Eten', product: 'Steak', variant: 'kind', prijsCents: 1200, categorie: 'Eten', station: 'Keuken', btwBp: null, code: null, snelknoppen: null, zichtbaar: true },
]

// Text of the "Uitleg" sheet — same rules as DOMAIN_MODEL.md.
export function explanationRows(title: string): [string, string][] {
  return [
    ['Menukaart', title],
    ['', ''],
    ['Kolom', 'Betekenis'],
    ['Groep', 'Tabblad/groep op de kassa. Volgorde van de rijen = volgorde op de kassa.'],
    ['Product', 'Het product. Hetzelfde product mag op meerdere rijen staan (één rij per variant).'],
    ['Variant', 'Leeg = product zonder varianten. Anders bv. normaal / jeugd / kind of niet-lid / lid.'],
    ['Prijs', 'Prijs op deze menukaart, in euro (8,50 of 8.50 of € 8,50). Nooit overgenomen van de rij erboven.'],
    ['Categorie', 'Wat het product is (Drank, Eten, …) — voor rapporten. Hoort bij het product: op één rij invullen volstaat. Leeg bij een bestaand product = ongewijzigd, bij een nieuw product = niet ingesteld.'],
    ['Station', 'Wie het klaarmaakt — Bar, Keuken, … Hoort bij het product: op één rij invullen volstaat. Leeg bij een bestaand product = ongewijzigd, bij een nieuw product = geen station.'],
    ['BTW', 'Tarief in % (0, 6, 12, 21). Hoort bij het product: op één rij invullen volstaat. Leeg bij een bestaand product = ongewijzigd, bij een nieuw product = niet ingesteld. Tarieven nog te bevestigen door de boekhouder.'],
    ['Code', 'Optioneel, uniek. Blijft de code gelijk, dan wordt een gewijzigde naam als hernoeming gezien. Leeg bij een bestaande variant = ongewijzigd.'],
    ['Snelknoppen', 'Optioneel, bv. 5, 10, 20 — knoppen om in één tik meerdere stuks te verkopen.'],
    ['Zichtbaar', 'ja/nee — nee = staat op de menukaart maar niet op de kassa. Leeg = ja.'],
    ['', ''],
    ['Regel', ''],
    ['Lege cel', 'Groep en Product: leeg = waarde van de rij erboven.'],
    ['', 'Categorie, Station en BTW: horen bij het product — op één rij van dat product invullen volstaat (maakt niet uit welke). Overal leeg: bij een bestaand product blijft de waarde ongewijzigd, bij een nieuw product is ze niet ingesteld.'],
    ['', 'Producten horen bij de hele organisatie en kunnen op meerdere menukaarten staan: een import wist nooit hun categorie, station, BTW of code — dat doe je in de console.'],
    ['Drie begrippen', 'Groep = plaats op de kassa (per menukaart). Categorie = wat het is (rapporten). Station = wie het klaarmaakt (bar, keuken).'],
    ['', 'Prijs, Variant, Code, Snelknoppen en Zichtbaar worden nooit overgenomen.'],
    ['Sorteren', 'Een export vult altijd alles in, zodat sorteren/filteren in Excel veilig is. Met lege cellen: niet sorteren.'],
    ['Importeren', 'Eerst een voorbeeld van alle wijzigingen (nieuw, prijswijzigingen, verwijderde lijnen, fouten per rij), pas daarna Toepassen.'],
    ['', 'De import vervangt indeling en prijzen van deze menukaart. Producten worden nooit verwijderd — ze kunnen op andere menukaarten staan.'],
    ['Tegenstrijdig', 'Zelfde product met verschillende Categorie, Station of BTW op twee rijen = fout, met rijnummers.'],
  ]
}

// --- File names ---

export function exportFileName(catalogName: string, extension: 'xlsx' | 'csv'): string {
  const safe = catalogName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'menukaart'
  return `menukaart-${safe}.${extension}`
}

// Default name for "import as new menukaart": the file name without its
// extension and without our own "menukaart-" export prefix.
export function nameFromFileName(fileName: string): string {
  return fileName
    .replace(/\.(xlsx|csv)$/i, '')
    .replace(/^menukaart[-_ ]/i, '')
    .trim()
}

export function isCsvFile(fileName: string): boolean {
  return /\.csv$/i.test(fileName)
}

// --- Import preview ---

export interface PreviewSummary {
  newCategories: string[]
  newStations?: string[]
  newProducts: string[]
  newVariants: string[]
  updatedProducts: { name: string; changes: string[] }[]
  priceChanges: { name: string; fromCents: number; toCents: number }[]
  added: string[]
  removed: string[]
}

function euro(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

// The preview dialog's sections, in reading order, leaving out empty ones.
export function previewSections(summary: PreviewSummary): { title: string; items: string[] }[] {
  return [
    { title: 'Nieuwe categorieën', items: summary.newCategories },
    { title: 'Nieuwe stations', items: summary.newStations ?? [] },
    { title: 'Nieuwe producten', items: summary.newProducts },
    { title: 'Nieuwe varianten', items: summary.newVariants },
    { title: 'Productwijzigingen', items: summary.updatedProducts.map((p) => `${p.name}: ${p.changes.join(', ')}`) },
    { title: 'Prijswijzigingen', items: summary.priceChanges.map((p) => `${p.name}: ${euro(p.fromCents)} → ${euro(p.toCents)}`) },
    { title: 'Toegevoegd aan deze menukaart', items: summary.added },
    { title: 'Verwijderd van deze menukaart', items: summary.removed },
  ].filter((section) => section.items.length > 0)
}

export function importErrorText(error: { row: number | null; message: string }): string {
  return error.row === null ? error.message : `Rij ${error.row}: ${error.message}`
}
