#!/usr/bin/env node
// An Epson receipt printer on your network, simulated (README.md here).
// It speaks the real protocols, so Arcanum talks to it as to a TM-m30III:
//   push     ePOS-Print: POST https://<this>/cgi-bin/epos/service.cgi
//   polling  Server Direct Print: it asks a URL for work, prints, reports
// and shows each ticket as a receipt at https://<this>:<port>/.
//
//   node tools/printer-sim/server.mjs [--port 8043] [--data ~/.arcanum-printer-sim]
//        [--poll-url URL] [--id ID] [--password PW] [--interval S] [--cert F --key F]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:https'
import { networkInterfaces, homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATUS_OK, STATUS_PAPER_OUT, EPOS_NS, children, commands, digestAuthorization, escape, find, parseXml, printResponseInfo, soapResponse, textOf } from './epos.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv.slice(2).reduce((out, a, i, all) => (a.startsWith('--') ? [...out, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : out), [])
)
const data = args.data || join(homedir(), '.arcanum-printer-sim')
mkdirSync(join(data, 'tickets'), { recursive: true })

// Settings: defaults, then what the page saved, then the command line.
const DEFAULTS = { port: 8043, model: 'TM-m30III (simulated)', devid: 'local_printer', paper: 80, paperOut: false, poll: { enabled: false, url: '', id: '', password: '', interval: 10 } }
const configFile = join(data, 'config.json')
let config = { ...DEFAULTS, ...(existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {}) }
config.poll = { ...DEFAULTS.poll, ...config.poll }
if (args.port) config.port = Number(args.port)
if (args['poll-url']) config.poll = { ...config.poll, enabled: true, url: args['poll-url'] }
if (args.id) config.poll.id = args.id
if (args.password) config.poll.password = args.password
if (args.interval) config.poll.interval = Number(args.interval)
const save = () => writeFileSync(configFile, JSON.stringify(config, null, 2))

const addresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)

// HTTPS, as a real printer from an HTTPS page: a self-signed certificate for
// this machine's addresses, made once - or your own (--cert/--key, e.g. mkcert).
function certificate() {
  if (args.cert && args.key) return { cert: readFileSync(args.cert), key: readFileSync(args.key) }
  const cert = join(data, 'cert.pem')
  const key = join(data, 'key.pem')
  if (!existsSync(cert)) {
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...addresses().map((a) => `IP:${a}`)].join(',')
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-keyout', key, '-out', cert, '-subj', `/CN=${addresses()[0] || 'localhost'}`, '-addext', `subjectAltName=${san}`], { stdio: 'ignore' })
  }
  return { cert: readFileSync(cert), key: readFileSync(key) }
}

// Tickets: one JSON file each, kept across restarts.
let tickets = readdirSync(join(data, 'tickets'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(data, 'tickets', f), 'utf8')))
  .sort((a, b) => a.id - b.id)
const log = []
const clients = new Set()
function emit(type, payload) {
  const event = { type, at: new Date().toISOString(), ...payload }
  if (type === 'log') {
    log.push(event)
    if (log.length > 200) log.shift()
  }
  for (const res of clients) res.write(`data: ${JSON.stringify(event)}\n\n`)
}
const note = (kind, message, extra = {}) => emit('log', { kind, message, ...extra })

// One print request, from either route: printed (a ticket) or refused, as a
// printer would (wrong device id, paper out).
function print({ eposPrint, devid, printjobid, via }) {
  if (devid !== config.devid) return { success: false, code: 'DeviceNotFound', status: '0' }
  if (!eposPrint) return { success: false, code: 'SchemaError', status: STATUS_OK }
  if (config.paperOut) {
    note('error', `Paper out: ${via === 'push' ? 'push' : 'polled job'} refused (EPTR_REC_EMPTY)`)
    return { success: false, code: 'EPTR_REC_EMPTY', status: STATUS_PAPER_OUT }
  }
  const ticket = { id: (tickets.at(-1)?.id || 0) + 1, at: new Date().toISOString(), via, devid, printjobid: printjobid || '', paper: config.paper, commands: commands(eposPrint) }
  tickets.push(ticket)
  writeFileSync(join(data, 'tickets', `${String(ticket.id).padStart(6, '0')}.json`), JSON.stringify(ticket))
  emit('ticket', { ticket: { id: ticket.id, at: ticket.at, via, printjobid: ticket.printjobid } })
  note('print', `Printed ticket ${ticket.id} (${via}${printjobid ? `, job ${printjobid}` : ''})`, { ticket: ticket.id })
  return { success: true, code: '', status: STATUS_OK }
}

// Push: ePOS-Print over SOAP. devid/timeout in the query, or in the SOAP header.
function eposPrintService(url, body) {
  let doc
  try {
    doc = parseXml(body)
  } catch (err) {
    note('error', `Push: unreadable XML (${err.message})`)
    return soapResponse({ success: false, code: 'SchemaError', status: STATUS_OK })
  }
  const param = find(doc, 'parameter')
  const devid = url.searchParams.get('devid') || (param && textOf(find(param, 'devid') || {})) || ''
  const printjobid = param ? textOf(find(param, 'printjobid') || {}) : ''
  const header = param
    ? `<parameter xmlns="${EPOS_NS}">${['devid', 'timeout', 'printjobid'].map((k) => (find(param, k) ? `<${k}>${escape(textOf(find(param, k)))}</${k}>` : '')).join('')}</parameter>`
    : ''
  note('push', `Push received (devid ${devid || '-'}${printjobid ? `, job ${printjobid}` : ''})`)
  const r = print({ eposPrint: find(doc, 'epos-print'), devid, printjobid, via: 'push' })
  return soapResponse({ ...r, header })
}

// Polling: Server Direct Print. Ask, print what came, report, wait the
// interval (counted from the end of the exchange, as the printer does).
let pollTimer
async function post(form) {
  const { url, id, password } = config.poll
  const body = new URLSearchParams(form).toString()
  const send = (auth) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(auth ? { Authorization: auth } : {}) }, body })
  let res = await send()
  const challenge = res.headers.get('www-authenticate')
  if (res.status === 401 && challenge?.startsWith('Digest') && password) {
    const u = new URL(url)
    res = await send(digestAuthorization({ challenge, method: 'POST', uri: u.pathname + u.search, user: id, password }))
  }
  return res
}
async function pollOnce() {
  const { enabled, url, id, interval } = config.poll
  if (!enabled || !url) return
  const started = Date.now()
  try {
    const res = await post({ ConnectionType: 'GetRequest', ID: id })
    const text = (await res.text()).trim()
    if (!res.ok) {
      note('error', `Poll: HTTP ${res.status}${text ? ` - ${text.slice(0, 120)}` : ''}`)
      return
    }
    if (!text) {
      emit('poll', { result: 'nothing', ms: Date.now() - started })
      return
    }
    const info = find(parseXml(text), 'PrintRequestInfo')
    if (!info) {
      note('error', 'Poll: answer is neither empty nor a PrintRequestInfo')
      return
    }
    const version = info.attrs.Version || '1.00'
    const jobs = children(info, 'ePOSPrint')
    emit('poll', { result: `${jobs.length} job${jobs.length === 1 ? '' : 's'}`, ms: Date.now() - started })
    const results = jobs.map((job) => {
      const param = find(job, 'Parameter') || {}
      const devid = textOf(find(param, 'devid') || {})
      const printjobid = textOf(find(param, 'printjobid') || {})
      return { devid, printjobid, ...print({ eposPrint: find(find(job, 'PrintData') || {}, 'epos-print'), devid, printjobid, via: 'poll' }) }
    })
    const report = await post({ ConnectionType: 'SetResponse', ID: id, ResponseFile: printResponseInfo(version, results) })
    note(report.ok ? 'poll' : 'error', `Reported ${results.length} result${results.length === 1 ? '' : 's'}: HTTP ${report.status}`)
  } catch (err) {
    note('error', `Poll: ${err.cause?.code || err.message} (${url})`)
  } finally {
    schedulePoll(interval * 1000)
  }
}
function schedulePoll(ms) {
  clearTimeout(pollTimer)
  if (config.poll.enabled && config.poll.url) pollTimer = setTimeout(pollOnce, ms)
}

// The printer's own answers allow any page to call it (Epson's CORS headers).
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, HEADER', 'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Authorization, SOAPAction, If-Modified-Since' }
const json = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json', ...CORS }).end(JSON.stringify(body))
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b)) })
const publicConfig = () => ({ ...config, poll: { ...config.poll, password: config.poll.password ? '••••' : '' } })

const server = createServer(certificate(), async (req, res) => {
  const url = new URL(req.url, 'https://printer')
  if (req.method === 'OPTIONS') return res.writeHead(200, CORS).end()
  if (url.pathname === '/cgi-bin/epos/service.cgi' && req.method === 'POST') {
    return res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8', ...CORS }).end(eposPrintService(url, await readBody(req)))
  }
  if (url.pathname === '/' && req.method === 'GET') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(join(here, 'page.html')))
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return res.write(': hello\n\n')
  }
  if (url.pathname === '/api/state') {
    return json(res, 200, { config: publicConfig(), hosts: addresses().map((a) => `${a}:${config.port}`), tickets: tickets.map(({ id, at, via, printjobid }) => ({ id, at, via, printjobid })).reverse(), log })
  }
  const one = url.pathname.match(/^\/api\/tickets\/(\d+)$/)
  if (one) {
    const t = tickets.find((x) => x.id === Number(one[1]))
    return t ? json(res, 200, t) : json(res, 404, { error: 'no such ticket' })
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    const next = JSON.parse((await readBody(req)) || '{}')
    const poll = { ...config.poll, ...(next.poll || {}) }
    if (next.poll?.password === '••••') poll.password = config.poll.password // unchanged
    config = { ...config, ...next, poll, port: config.port }
    save()
    note('config', 'Settings saved')
    schedulePoll(0)
    return json(res, 200, { config: publicConfig() })
  }
  if (url.pathname === '/api/tickets/clear' && req.method === 'POST') {
    for (const f of readdirSync(join(data, 'tickets'))) rmSync(join(data, 'tickets', f))
    tickets = []
    emit('cleared', {})
    return json(res, 200, { ok: true })
  }
  if (url.pathname === '/api/poll-now' && req.method === 'POST') {
    schedulePoll(0)
    return json(res, 200, { ok: true })
  }
  res.writeHead(404, CORS).end()
})

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Epson printer simulator - ${config.model}`)
  for (const h of ['localhost:' + config.port, ...addresses().map((a) => `${a}:${config.port}`)]) console.log(`  https://${h}/`)
  console.log(`  push:  host ${addresses()[0] || 'localhost'}, port ${config.port} (ePOS-Print, device id ${config.devid})`)
  console.log(`  poll:  ${config.poll.enabled && config.poll.url ? `${config.poll.url} every ${config.poll.interval} s` : 'off (set it on the page)'}`)
  console.log(`  data:  ${data}`)
  schedulePoll(1000)
})
