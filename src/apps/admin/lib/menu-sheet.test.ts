import { describe, expect, it } from 'vitest'
import {
  exportCsvRows,
  exportFileName,
  exportRowCells,
  HEADERS,
  importErrorText,
  isCsvFile,
  MAX_IMPORT_ROWS,
  nameFromFileName,
  parseCsv,
  parseSheetRows,
  previewSections,
  toCsv,
  type ExportRow,
} from './menu-sheet'

const steak: ExportRow = {
  groep: 'Eten',
  product: 'Steak',
  variant: 'kind',
  prijsCents: 1250,
  categorie: 'Eten',
  btwBp: 1200,
  code: 'steak-kind',
  snelknoppen: [5, 10],
  zichtbaar: true,
}

describe('parseSheetRows: header mapping', () => {
  it('maps the 9 headers case- and whitespace-insensitively, in any order', () => {
    const parsed = parseSheetRows([
      ['  prijs', 'GROEP', 'Product ', 'Snel knoppen', 'btw'],
      [8.5, 'Eten', 'Steak', '5, 10', 21],
    ])
    expect(parsed.errors).toEqual([])
    expect(parsed.rows).toEqual([
      { row: 2, groep: 'Eten', product: 'Steak', variant: null, prijs: 8.5, categorie: null, btw: 21, code: null, snelknoppen: '5, 10', zichtbaar: null },
    ])
  })

  it('refuses a file without the required Groep, Product or Prijs header', () => {
    const parsed = parseSheetRows([
      ['Groep', 'Naam', 'Variant'],
      ['Eten', 'Steak', ''],
    ])
    expect(parsed.rows).toEqual([])
    expect(parsed.errors[0]).toContain('Product, Prijs')
  })

  it('ignores unknown columns and reports them', () => {
    const parsed = parseSheetRows([
      ['Groep', 'Product', 'Prijs', 'Opmerking'],
      ['Drank', 'Pils', 2.5, 'lekker'],
    ])
    expect(parsed.ignoredHeaders).toEqual(['Opmerking'])
    expect(parsed.rows[0]).not.toHaveProperty('opmerking')
  })

  it('uses the first non-empty row as the header and keeps real sheet row numbers', () => {
    const parsed = parseSheetRows([
      [],
      [null, '', null],
      ['Groep', 'Product', 'Prijs'],
      ['Drank', 'Pils', 2.5],
      [null, null, null],
      ['', '   ', ''],
      [null, 'Cola', '2,00'],
    ])
    expect(parsed.rows.map((r) => [r.row, r.product])).toEqual([
      [4, 'Pils'],
      [7, 'Cola'],
    ])
  })

  it('keeps cell values raw — interpretation is the backend’s job', () => {
    const [row] = parseSheetRows([
      ['Groep', 'Product', 'Prijs', 'BTW', 'Zichtbaar'],
      ['Drank', 'Pils', '€ 2,50', 0.21, true],
    ]).rows
    expect([row.prijs, row.btw, row.zichtbaar]).toEqual(['€ 2,50', 0.21, true])
  })

  it('turns empty strings into null and a date cell into an ISO string', () => {
    const [row] = parseSheetRows([
      ['Groep', 'Product', 'Prijs', 'Code'],
      ['Drank', 'Pils', new Date('2026-01-02T00:00:00Z'), '  '],
    ]).rows
    expect(row.prijs).toBe('2026-01-02T00:00:00.000Z')
    expect(row.code).toBeNull()
  })

  it('reports an empty file, a header without rows, and too many rows', () => {
    expect(parseSheetRows([]).errors).toEqual(['Het bestand is leeg.'])
    expect(parseSheetRows([['Groep', 'Product', 'Prijs']]).errors[0]).toContain('Geen rijen')
    const many = [['Groep', 'Product', 'Prijs'], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ['G', `P${i}`, 1])]
    expect(parseSheetRows(many).errors[0]).toContain(`${MAX_IMPORT_ROWS + 1}`)
  })
})

describe('parseCsv', () => {
  it('detects the Belgian ; delimiter and keeps decimal commas as text', () => {
    expect(parseCsv('Groep;Product;Prijs\nDrank;Pils;2,50\n')).toEqual([
      ['Groep', 'Product', 'Prijs'],
      ['Drank', 'Pils', '2,50'],
    ])
  })

  it('detects , and tab delimiters', () => {
    expect(parseCsv('Groep,Product,Prijs\r\nDrank,Pils,2.50')).toEqual([
      ['Groep', 'Product', 'Prijs'],
      ['Drank', 'Pils', '2.50'],
    ])
    expect(parseCsv('Groep\tProduct\nDrank\tPils')[1]).toEqual(['Drank', 'Pils'])
  })

  it('handles quotes: delimiters, doubled quotes and newlines inside a field', () => {
    expect(parseCsv('Groep;Product\n"Eten; warm";"Steak ""XL""\nmet saus"\n')).toEqual([
      ['Groep', 'Product'],
      ['Eten; warm', 'Steak "XL"\nmet saus'],
    ])
  })

  it('drops a UTF-8 BOM and keeps empty lines so line numbers stay right', () => {
    const rows = parseCsv('﻿Groep;Product;Prijs\n\nDrank;Pils;2,50\n')
    expect(rows[0][0]).toBe('Groep')
    expect(parseSheetRows(rows).rows[0].row).toBe(3)
  })
})

describe('export', () => {
  it('writes one row per line in column order: € number, BTW as percentage, ja/nee', () => {
    expect(exportRowCells(steak)).toEqual(['Eten', 'Steak', 'kind', 12.5, 'Eten', 12, 'steak-kind', '5, 10', 'ja'])
    expect(exportRowCells({ ...steak, variant: '', categorie: null, btwBp: null, code: null, snelknoppen: null, zichtbaar: false })).toEqual([
      'Eten',
      'Steak',
      '',
      12.5,
      '',
      '',
      '',
      '',
      'nee',
    ])
  })

  it('writes CSV for Belgian Excel: header row, decimal comma, ; delimiter, BOM, quoting', () => {
    const rows = exportCsvRows([steak, { ...steak, product: 'Steak; XL', prijsCents: 1800, btwBp: 550 }])
    expect(rows[0]).toEqual(HEADERS)
    expect(rows[1]).toEqual(['Eten', 'Steak', 'kind', '12,50', 'Eten', '12', 'steak-kind', '5, 10', 'ja'])
    expect(rows[2][3]).toBe('18,00')
    expect(rows[2][5]).toBe('5,50')
    const csv = toCsv(rows)
    expect(csv.startsWith('﻿Groep;Product;')).toBe(true)
    expect(csv).toContain(';"Steak; XL";')
  })

  it('round-trips: an exported CSV reads back into the same raw rows', () => {
    const parsed = parseSheetRows(parseCsv(toCsv(exportCsvRows([steak]))))
    expect(parsed.rows[0]).toEqual({
      row: 2,
      groep: 'Eten',
      product: 'Steak',
      variant: 'kind',
      prijs: '12,50',
      categorie: 'Eten',
      btw: '12',
      code: 'steak-kind',
      snelknoppen: '5, 10',
      zichtbaar: 'ja',
    })
  })

  it('names files after the menukaart, without characters Windows refuses', () => {
    expect(exportFileName('Zomer 2026', 'xlsx')).toBe('menukaart-Zomer 2026.xlsx')
    expect(exportFileName('Kaas/Wijn: "2026"', 'csv')).toBe('menukaart-Kaas-Wijn- -2026-.csv')
    expect(exportFileName('  ', 'xlsx')).toBe('menukaart-menukaart.xlsx')
  })
})

describe('file names on import', () => {
  it('suggests a name from the file name and recognizes CSV', () => {
    expect(nameFromFileName('menukaart-Zomer 2026.xlsx')).toBe('Zomer 2026')
    expect(nameFromFileName('Fuif.CSV')).toBe('Fuif')
    expect(isCsvFile('a.CSV')).toBe(true)
    expect(isCsvFile('a.xlsx')).toBe(false)
  })
})

describe('preview', () => {
  it('lists only non-empty sections, with prices in euro', () => {
    const sections = previewSections({
      newCategories: [],
      newProducts: ['Cola'],
      newVariants: [],
      updatedProducts: [{ name: 'Pils', changes: ['categorie: Drank → Bier'] }],
      priceChanges: [{ name: 'Pils', fromCents: 250, toCents: 275 }],
      added: ['Cola'],
      removed: ['Steak (kind)'],
    })
    expect(sections).toEqual([
      { title: 'Nieuwe producten', items: ['Cola'] },
      { title: 'Productwijzigingen', items: ['Pils: categorie: Drank → Bier'] },
      { title: 'Prijswijzigingen', items: ['Pils: € 2,50 → € 2,75'] },
      { title: 'Toegevoegd aan deze menukaart', items: ['Cola'] },
      { title: 'Verwijderd van deze menukaart', items: ['Steak (kind)'] },
    ])
  })

  it('prefixes errors with their row number when there is one', () => {
    expect(importErrorText({ row: 7, message: 'Prijs ontbreekt' })).toBe('Rij 7: Prijs ontbreekt')
    expect(importErrorText({ row: null, message: 'Geen groepen' })).toBe('Geen groepen')
  })
})
