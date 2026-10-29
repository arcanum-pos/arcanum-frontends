import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkReachable, printerUrl, sendToEpson, showFingerprint } from './printing'

const printer = { host: '192.168.1.50', port: 443, deviceId: 'local_printer' }
const answer = (success: boolean, code = '') =>
  `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="${success}" code="${code}" status="251658262" battery="0"/></s:Body></s:Envelope>`

afterEach(() => vi.unstubAllGlobals())

describe('sendToEpson (ePOS-Print)', () => {
  it('posts the job in a SOAP envelope to the printer, and reads its answer', async () => {
    const fetch = vi.fn(async () => new Response(answer(true)))
    vi.stubGlobal('fetch', fetch)
    expect(await sendToEpson(printer, '<epos-print xmlns="x"><text>Hi</text></epos-print>')).toEqual({ success: true, code: '' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://192.168.1.50/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain('<s:Body><epos-print xmlns="x"><text>Hi</text></epos-print></s:Body>')
  })

  it("passes on the printer's own refusal", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(answer(false, 'EPTR_REC_EMPTY'))))
    expect(await sendToEpson(printer, '<epos-print/>')).toEqual({ success: false, code: 'EPTR_REC_EMPTY' })
  })

  it('says unreachable when the browser gets nothing (off, wrong address, certificate not accepted)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await sendToEpson(printer, '<epos-print/>')).toEqual({ success: false, code: 'unreachable' })
  })

  it('addresses a printer on another port', () => {
    expect(printerUrl({ host: '192.168.1.45', port: 8043 })).toBe('https://192.168.1.45:8043/')
    expect(printerUrl({ host: 'printer.local', port: 443 })).toBe('https://printer.local/')
  })
})

describe('checkReachable', () => {
  it('any answer, even an opaque one, means this browser reaches (and trusts) the printer', async () => {
    const fetch = vi.fn(async () => new Response(null))
    vi.stubGlobal('fetch', fetch)
    expect(await checkReachable({ host: '192.168.1.50', port: 8043 })).toBe(true)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://192.168.1.50:8043/')
    expect(init.mode).toBe('no-cors')
  })

  it('a failed request (untrusted certificate, off, wrong address) does not; no address neither', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await checkReachable({ host: '192.168.1.50', port: 443 })).toBe(false)
    expect(await checkReachable({ host: null, port: null })).toBe(false)
  })

  it('shows a fingerprint as Keychain and Windows do', () => {
    expect(showFingerprint('ab01ff')).toBe('AB:01:FF')
  })
})
