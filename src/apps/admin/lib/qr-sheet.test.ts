import { describe, expect, it } from 'vitest'
import { qrSheetHtml } from './qr-sheet'

const card = (i: number) => ({ name: `Tafel ${i}`, zone: i % 2 ? 'Terras' : null, svg: '<svg></svg>' })

describe('qrSheetHtml', () => {
  it('12 cards a page, each page its own block', () => {
    const html = qrSheetHtml('QR-codes', Array.from({ length: 25 }, (_, i) => card(i + 1)))
    expect(html.match(/class="page"/g)).toHaveLength(3)
    expect(html.match(/class="card"/g)).toHaveLength(25)
    expect(html).toContain('<title>QR-codes</title>')
    expect(html).toContain('@page { size: A4 portrait; margin: 12mm; }')
  })

  it('escapes names, zones and the title', () => {
    const html = qrSheetHtml('<QR>', [{ name: 'Tafel <b>1</b>', zone: 'Bar & "zaal"', svg: '<svg></svg>' }], 'fr')
    expect(html).toContain('<title>&lt;QR&gt;</title>')
    expect(html).toContain('Tafel &lt;b&gt;1&lt;/b&gt;')
    expect(html).toContain('Bar &amp; &quot;zaal&quot;')
    expect(html).toContain('<html lang="fr">')
  })
})
