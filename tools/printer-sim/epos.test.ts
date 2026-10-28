import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module, no types
import { commands, digestAuthorization, find, parseXml, printResponseInfo, soapResponse, textOf } from './epos.mjs'

describe('printer simulator: Epson formats', () => {
  it('reads an ePOS-Print SOAP request into the commands a printer runs', () => {
    const doc = parseXml(
      '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><parameter><devid>local_printer</devid><printjobid>J7</printjobid></parameter></s:Header>' +
        '<s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text align="center" em="true">Bar &amp; keuken&#10;</text><feed line="2"/><cut type="feed"/></epos-print></s:Body></s:Envelope>'
    )
    expect(textOf(find(find(doc, 'parameter'), 'printjobid'))).toBe('J7')
    expect(commands(find(doc, 'epos-print'))).toEqual([
      { tag: 'text', attrs: { align: 'center', em: 'true' }, text: 'Bar & keuken\n' },
      { tag: 'feed', attrs: { line: '2' }, text: '' },
      { tag: 'cut', attrs: { type: 'feed' }, text: '' },
    ])
  })

  it('refuses XML that is not closed', () => {
    expect(() => parseXml('<epos-print><text>x</epos-print>')).toThrow()
  })

  it('answers as ePOS-Print does', () => {
    expect(soapResponse({ success: false, code: 'EPTR_REC_EMPTY', status: '252641308' })).toContain(
      '<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="false" code="EPTR_REC_EMPTY" status="252641308" battery="0"/>'
    )
  })

  it('reports a Server Direct Print result in the version it was asked in', () => {
    const r = [{ devid: 'local_printer', printjobid: 'J1', success: true, code: '', status: '251658262' }]
    expect(printResponseInfo('2.00', r)).toContain('<Parameter><devid>local_printer</devid><printjobid>J1</printjobid></Parameter><PrintResponse><response')
    expect(printResponseInfo('1.00', r)).not.toContain('printjobid')
  })

  it('signs with HTTP Digest (the RFC 2617 example)', () => {
    const header = digestAuthorization({
      challenge: 'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
      method: 'GET',
      uri: '/dir/index.html',
      user: 'Mufasa',
      password: 'Circle Of Life',
      cnonce: '0a4f113b',
    })
    expect(header).toContain('response="6629fae49393a05397450978507c4ef1"')
    expect(header).toContain('qop=auth, nc=00000001, cnonce="0a4f113b"')
  })
})
