// Printing from a screen (arcanum/PRINTING.md): the screen hears `print_job
// {printer_id}` on its socket, lists that printer's waiting jobs, claims
// each (arcanum-backend printing.ts - exactly one screen wins), sends it to
// the printer on this network and reports the printer's answer.
//
// The printer: Epson ePOS-Print, POST https://<host>:<port>/cgi-bin/epos/
// service.cgi with the job's <epos-print> in a SOAP envelope - from an
// HTTPS page it must be HTTPS, so the printer's certificate is accepted once
// in this browser (open https://<host>:<port>/).
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '@/shared/api-errors'

export interface Printer {
  id: string
  name: string
  brand: 'epson' | 'star'
  connection: 'push' | 'poll'
  host: string | null
  port: number | null
  deviceId: string
  paperMm: 58 | 80
  // Polling: when it last asked (to the minute), and - only in the answer
  // that made it, or from showPrinterKey - the secret for its URL.
  lastPollAt: string | null
  pollKey?: string
  stations: { id: string; name: string }[]
}

export interface PrintJob {
  id: string
  kind: 'ticket' | 'receipt' | 'test'
  title: string
  status: 'waiting' | 'failed'
  error: string | null
  attempts: number
  createdAt: string
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/organizations/${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { status: res.status, code: data?.code })
  return data as T
}
const org = (orgId: string) => encodeURIComponent(orgId)

export const listPrinters = (orgId: string) => call<Printer[]>(`${org(orgId)}/printers`)
export const listPrintJobs = (orgId: string, printerId: string) => call<PrintJob[]>(`${org(orgId)}/printers/${encodeURIComponent(printerId)}/jobs`)
export const testPrint = (orgId: string, printerId: string) => call<{ id: string }>(`${org(orgId)}/printers/${encodeURIComponent(printerId)}/test`, { method: 'POST' })
export const retryPrintJob = (orgId: string, jobId: string) => call<{ ok: true }>(`${org(orgId)}/print-jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' })
export const setStationPrinter = (orgId: string, stationId: string, printerId: string | null) =>
  call<{ ok: true }>(`${org(orgId)}/stations/${encodeURIComponent(stationId)}/printer`, { method: 'PUT', body: JSON.stringify({ printerId }) })

// The printer's own address, to accept its certificate (and its settings page).
export const printerUrl = (p: { host: string | null; port: number | null }) => `https://${p.host}${p.port && p.port !== 443 ? `:${p.port}` : ''}/`

// One ePOS-Print request. `code`: the printer's (EPTR_REC_EMPTY, …), or
// 'unreachable' when the browser couldn't reach it at all (off, wrong
// address, certificate not accepted - a page can't tell these apart).
export async function sendToEpson(printer: { host: string | null; port: number | null; deviceId: string }, document: string): Promise<{ success: boolean; code: string }> {
  const url = `${printerUrl(printer)}cgi-bin/epos/service.cgi?devid=${encodeURIComponent(printer.deviceId)}&timeout=10000`
  const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${document}</s:Body></s:Envelope>`
  let text: string
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body, signal: AbortSignal.timeout(15_000) })
    text = await res.text()
  } catch {
    return { success: false, code: 'unreachable' }
  }
  const response = text.match(/<response\b[^>]*>/)?.[0] ?? ''
  const attr = (name: string) => response.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? ''
  if (!response) return { success: false, code: 'SchemaError' }
  return { success: attr('success') === 'true', code: attr('code') }
}

export type PrintState = { phase: 'idle' } | { phase: 'printing' } | { phase: 'problem'; code: string }

// Prints a printer's jobs from this screen: on start, when told (`poke`),
// and when the screen is looked at again (a push missed while asleep). One
// run at a time; a poke during a run makes one more run after it. A job that
// fails stops the run - the rest wait until it's sorted (a retry).
export function usePrintRunner(orgId: string | null, printer: Printer | null) {
  const [state, setState] = useState<PrintState>({ phase: 'idle' })
  const [failed, setFailed] = useState<PrintJob[]>([])
  const running = useRef(false)
  const again = useRef(false)
  const current = useRef({ orgId, printer })
  useEffect(() => {
    current.current = { orgId, printer }
  }, [orgId, printer])

  const run = useCallback(async () => {
    const { orgId, printer } = current.current
    if (!orgId || !printer) return
    // A printer that asks for its work prints by itself: only show what failed.
    if (printer.connection !== 'push') {
      listPrintJobs(orgId, printer.id).then((jobs) => setFailed(jobs.filter((j) => j.status === 'failed')), () => {})
      return
    }
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    try {
      const jobs = await listPrintJobs(orgId, printer.id)
      setFailed(jobs.filter((j) => j.status === 'failed'))
      let problem: string | null = null
      for (const job of jobs.filter((j) => j.status === 'waiting')) {
        let claimed: { claim: string; document: string; printer: { host: string; port: number; deviceId: string } }
        try {
          claimed = await call(`${org(orgId)}/print-jobs/${encodeURIComponent(job.id)}/claim`, { method: 'POST' })
        } catch {
          continue // another screen has it
        }
        setState({ phase: 'printing' })
        const result = await sendToEpson(claimed.printer, claimed.document)
        await call(`${org(orgId)}/print-jobs/${encodeURIComponent(job.id)}/result`, { method: 'POST', body: JSON.stringify({ claim: claimed.claim, ...result }) }).catch(() => {})
        if (!result.success) {
          problem = result.code
          setFailed((list) => [...list, { ...job, status: 'failed', error: result.code }])
          break
        }
      }
      setState(problem ? { phase: 'problem', code: problem } : { phase: 'idle' })
    } catch {
      // The list couldn't be fetched: tried again on the next poke.
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        void run()
      }
    }
  }, [])

  useEffect(() => {
    setFailed([])
    setState({ phase: 'idle' })
    void run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [orgId, printer?.id, run])

  const poke = useCallback(
    (printerId: unknown) => {
      if (printerId === current.current.printer?.id) void run()
    },
    [run]
  )

  const retry = useCallback(
    async (jobId: string) => {
      const { orgId } = current.current
      if (!orgId) return
      setFailed((list) => list.filter((j) => j.id !== jobId))
      await retryPrintJob(orgId, jobId).catch(() => {})
      void run()
    },
    [run]
  )

  return { state, failed, poke, retry, run }
}

// The console's side: printers of the org (admins).
export interface PrinterInput {
  name: string
  brand: 'epson'
  connection: 'push' | 'poll'
  host?: string
  port?: number
  paperMm: 58 | 80
  stationIds: string[]
}
export const createPrinter = (orgId: string, p: PrinterInput) => call<Printer>(`${org(orgId)}/printers`, { method: 'POST', body: JSON.stringify(p) })
export const updatePrinter = (orgId: string, id: string, p: Partial<PrinterInput>) => call<Printer>(`${org(orgId)}/printers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(p) })
export const deletePrinter = (orgId: string, id: string) => call<{ ok: true }>(`${org(orgId)}/printers/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const newPrinterKey = (orgId: string, id: string) => call<Printer>(`${org(orgId)}/printers/${encodeURIComponent(id)}/key`, { method: 'POST' })

// The URL a polling printer is given (Server Direct Print), on this installation's address.
export const pollUrl = (printer: { id: string; pollKey?: string }) => `${window.location.origin}/api/public/print/epson/${encodeURIComponent(printer.id)}?key=${printer.pollKey}`

// A polling printer's secret again, to show its URL (null: made before it
// was kept - a new link makes one).
export const showPrinterKey = (orgId: string, id: string) => call<{ pollKey: string | null }>(`${org(orgId)}/printers/${encodeURIComponent(id)}/key`).then((r) => r.pollKey)

// Has a polling printer asked lately? Its last ask is kept to the minute;
// how often it asks is set in the printer (10 s recommended).
export const pollingLately = (p: Printer, now = Date.now()) => !!p.lastPollAt && now - Date.parse(p.lastPollAt) < 5 * 60_000

// --- Receipts (switched on per organisation; the printer chosen per device) ---

export const getReceiptsEnabled = (orgId: string) => call<{ enabled: boolean }>(`${org(orgId)}/receipt-settings`).then((r) => r.enabled)
export const setReceiptsEnabled = (orgId: string, enabled: boolean) => call<{ enabled: boolean }>(`${org(orgId)}/receipt-settings`, { method: 'PUT', body: JSON.stringify({ enabled }) })
export const printReceipt = (orgId: string, printerId: string, tabId: string, chargeId?: string) =>
  call<{ id: string }>(`${org(orgId)}/printers/${encodeURIComponent(printerId)}/receipt`, { method: 'POST', body: JSON.stringify({ tabId, chargeId }) })

// This device's receipt printer, and whether it prints after every payment
// by itself - per browser and organisation, like the SumUp reader.
const RECEIPT_KEY = 'arcanum-receipt-printer'
export interface ReceiptChoice {
  printerId: string | null
  auto: boolean
}
export function getReceiptChoice(orgId: string): ReceiptChoice {
  try {
    const all = JSON.parse(localStorage.getItem(RECEIPT_KEY) || '{}')
    return { printerId: all[orgId]?.printerId ?? null, auto: all[orgId]?.auto === true }
  } catch {
    return { printerId: null, auto: false }
  }
}
export function setReceiptChoice(orgId: string, choice: ReceiptChoice): void {
  try {
    const all = JSON.parse(localStorage.getItem(RECEIPT_KEY) || '{}')
    localStorage.setItem(RECEIPT_KEY, JSON.stringify({ ...all, [orgId]: choice }))
  } catch {
    // not remembered
  }
}

// Receipts on this device: switched on for the org? which printer? Null
// while loading or when off.
export function useReceiptPrinter(orgId: string | null) {
  const [enabled, setEnabled] = useState(false)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [choice, setChoice] = useState<ReceiptChoice>(() => (orgId ? getReceiptChoice(orgId) : { printerId: null, auto: false }))
  useEffect(() => {
    if (!orgId) return
    let live = true
    getReceiptsEnabled(orgId)
      .then(async (on) => {
        if (!live) return
        setEnabled(on)
        setChoice(getReceiptChoice(orgId))
        if (on) setPrinters(await listPrinters(orgId))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [orgId])
  const choose = useCallback(
    (next: ReceiptChoice) => {
      if (!orgId) return
      setReceiptChoice(orgId, next)
      setChoice(next)
    },
    [orgId]
  )
  const printer = enabled ? (printers.find((p) => p.id === choice.printerId) ?? null) : null
  return { enabled, printers, printer, auto: choice.auto, choice, choose }
}
