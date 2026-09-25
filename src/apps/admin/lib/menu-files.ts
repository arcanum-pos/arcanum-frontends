// Reading and writing menukaart files (.xlsx / .csv). The only module that
// imports the spreadsheet libraries — always loaded with a dynamic
// import() when someone exports or imports, so the rest of the console
// never ships that code. The sheet logic itself is in menu-sheet.ts.
import writeXlsxFile, { type Row, type SheetData } from 'write-excel-file/browser'
import { readSheet } from 'read-excel-file/browser'
import {
  COLUMNS,
  explanationRows,
  exportCsvRows,
  exportFileName,
  exportRowCells,
  HEADERS,
  isCsvFile,
  parseCsv,
  parseSheetRows,
  TEMPLATE_ROWS,
  toCsv,
  type ExportRow,
  type ParsedSheet,
} from './menu-sheet'

const WIDTHS = [14, 18, 14, 10, 16, 7, 18, 22, 11]
const HEADER_STYLE = { fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#1F2937' } as const

function menuSheetData(rows: ExportRow[]): SheetData {
  const header: Row = HEADERS.map((value) => ({ value, ...HEADER_STYLE }))
  const body: Row[] = rows.map((row) =>
    exportRowCells(row).map((value, i) => {
      if (COLUMNS[i].key === 'prijs') return { value: value as number, type: Number, format: '€ #,##0.00' }
      if (typeof value === 'number') return { value, type: Number }
      return value === '' ? null : { value, type: String }
    })
  )
  return [header, ...body]
}

function explanationSheetData(title: string): SheetData {
  return explanationRows(title).map(([a, b], i) => {
    const bold = i === 0 || a === 'Kolom' || a === 'Regel'
    return [a ? { value: a, fontWeight: bold ? 'bold' : undefined } : null, b ? { value: b, wrap: true, fontWeight: bold ? 'bold' : undefined } : null]
  })
}

async function xlsxBlob(rows: ExportRow[], title: string): Promise<Blob> {
  return writeXlsxFile([
    { sheet: 'Menukaart', data: menuSheetData(rows), columns: WIDTHS.map((width) => ({ width })), stickyRowsCount: 1 },
    { sheet: 'Uitleg', data: explanationSheetData(title), columns: [{ width: 16 }, { width: 95 }] },
  ]).toBlob()
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadMenu(catalogName: string, rows: ExportRow[], format: 'xlsx' | 'csv') {
  if (format === 'csv') {
    download(new Blob([toCsv(exportCsvRows(rows))], { type: 'text/csv;charset=utf-8' }), exportFileName(catalogName, 'csv'))
    return
  }
  const today = new Date().toLocaleDateString('nl-BE')
  const title = `${catalogName} — export van ${today}. Eén bestand = één menukaart, één rij = één knop op de kassa.`
  download(await xlsxBlob(rows, title), exportFileName(catalogName, 'xlsx'))
}

export async function downloadTemplate() {
  const title = 'Sjabloon — vervang de voorbeeldrijen door je eigen menukaart. Eén rij = één knop op de kassa.'
  download(await xlsxBlob(TEMPLATE_ROWS, title), 'menukaart-sjabloon.xlsx')
}

// First sheet of an .xlsx, or a .csv, as raw cells mapped to the 9 columns.
export async function readMenuFile(file: File): Promise<ParsedSheet> {
  if (isCsvFile(file.name)) return parseSheetRows(parseCsv(await file.text()))
  try {
    return parseSheetRows(await readSheet(file))
  } catch {
    return { errors: ['Kon dit bestand niet lezen. Gebruik een .xlsx- of .csv-bestand.'], ignoredHeaders: [], rows: [] }
  }
}
