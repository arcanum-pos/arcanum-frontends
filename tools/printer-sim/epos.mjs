// The Epson side of the printer simulator: just enough XML to read what an
// Epson printer reads (ePOS-Print, Server Direct Print) and to answer as it
// answers. Formats from Epson's ePOS-Print XML and Server Direct Print
// manuals - see PRINTING.md (arcanum/), "Epson protocols (checked)".
import { createHash, randomBytes } from 'node:crypto'

export const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print'

// The status a printer reports with its answer: ready, and paper out
// (the values in Epson's own examples).
export const STATUS_OK = '251658262'
export const STATUS_PAPER_OUT = '252641308'

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
export const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? m)
  )
export const escape = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])

// A small XML reader: elements with attributes, text, comments, CDATA.
// Names keep their prefix in `name`; `local` drops it (s:Body -> Body).
export function parseXml(xml) {
  const root = { name: '#root', local: '#root', attrs: {}, children: [] }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  let m
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1]
    if (m[1] !== undefined) top.children.push({ text: m[1] })
    else if (m[2]) {
      if (stack.length === 1 || top.name !== m[2]) throw new Error(`unexpected </${m[2]}>`)
      stack.pop()
    } else if (m[3]) {
      const attrs = {}
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].replace(/^.*:/, '')] = decode(a[2] ?? a[3])
      const el = { name: m[3], local: m[3].replace(/^.*:/, ''), attrs, children: [] }
      top.children.push(el)
      if (!m[5]) stack.push(el)
    } else if (m[6] !== undefined) {
      if (m[6].trim() || top.local === 'text') top.children.push({ text: decode(m[6]) })
    }
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].name}> not closed`)
  return root
}

export const textOf = (el) => (el.children || []).map((c) => (c.text !== undefined ? c.text : textOf(c))).join('')
export function find(el, local) {
  for (const c of el.children || []) {
    if (c.local === local) return c
    const deeper = find(c, local)
    if (deeper) return deeper
  }
  return null
}
export const children = (el, local) => (el?.children || []).filter((c) => c.local === local)

// An <epos-print> as the list of commands a printer runs, in order.
export function commands(eposPrint) {
  return (eposPrint.children || []).filter((c) => c.local).map((c) => ({ tag: c.local, attrs: c.attrs, text: textOf(c) }))
}

// ePOS-Print's answer, inside a SOAP envelope (the header echoes the request's).
export function soapResponse({ success, code = '', status, header = '' }) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    (header ? `<s:Header>${header}</s:Header>` : '') +
    `<s:Body><response xmlns="${EPOS_NS}" success="${success}" code="${escape(code)}" status="${status}" battery="0"/></s:Body>` +
    '</s:Envelope>'
  )
}

// Server Direct Print: the result of one print request, as the printer
// reports it (PrintResponseInfo, in the version the request used).
export function printResponseInfo(version, results) {
  const response = (r) => `<response xmlns="${EPOS_NS}" success="${r.success}" code="${escape(r.code || '')}" status="${r.status}" battery="0"/>`
  if (version === '1.00') return `<?xml version="1.0" encoding="utf-8"?><PrintResponseInfo Version="1.00">${results.map(response).join('')}</PrintResponseInfo>`
  return (
    `<?xml version="1.0" encoding="utf-8"?><PrintResponseInfo Version="${version}">` +
    (version === '3.00' ? '<ServerDirectPrint><Response Success="true"/></ServerDirectPrint>' : '') +
    results
      .map((r) => `<ePOSPrint><Parameter><devid>${escape(r.devid)}</devid><printjobid>${escape(r.printjobid || '')}</printjobid></Parameter><PrintResponse>${response(r)}</PrintResponse></ePOSPrint>`)
      .join('') +
    '</PrintResponseInfo>'
  )
}

// HTTP Digest (RFC 7616, MD5, qop=auth): what a printer sends after a 401
// when its Server Direct Print ID and password are set.
export function digestAuthorization({ challenge, method, uri, user, password, nc = 1, cnonce = randomBytes(8).toString('hex') }) {
  const p = {}
  for (const m of challenge.replace(/^Digest\s+/i, '').matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)) p[m[1]] = m[2] ?? m[3]
  const md5 = (s) => createHash('md5').update(s).digest('hex')
  const ha1 = md5(`${user}:${p.realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)
  const qop = p.qop?.split(',').map((s) => s.trim()).includes('auth') ? 'auth' : undefined
  const ncHex = nc.toString(16).padStart(8, '0')
  const response = qop ? md5(`${ha1}:${p.nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${p.nonce}:${ha2}`)
  return (
    `Digest username="${user}", realm="${p.realm}", nonce="${p.nonce}", uri="${uri}", response="${response}"` +
    (p.opaque ? `, opaque="${p.opaque}"` : '') +
    (qop ? `, qop=${qop}, nc=${ncHex}, cnonce="${cnonce}"` : '') +
    (p.algorithm ? `, algorithm=${p.algorithm}` : '')
  )
}
