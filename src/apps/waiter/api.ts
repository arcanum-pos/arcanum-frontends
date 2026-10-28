// The waiter screen's calls to arcanum-backend (tables.ts, release C) —
// tabs, menus and payments go through the kassa's own modules.
import { apiErrorMessage } from '@/shared/api-errors'
import { getDeviceId, getDeviceName } from '@/shared/device'

export interface TableInfo {
  id: string
  name: string
  zone: string | null
  position: number
  archived: boolean
  state: 'free' | 'occupied' | 'clearing'
  tab: { id: string; number: number; label: string; openedAt: string; totalCents: number; preparing?: boolean } | null
  qrToken: string | null
  // Promised to guests waiting at the entrance (release D).
  promised?: boolean
}

export interface EventInfo {
  id: string
  name: string
  date: string | null
  modes: { id: string; name: string; catalogId: string | null; atTable: boolean }[]
}

async function call<T>(orgId: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { code: data?.code as string | undefined })
  return data as T
}

export const listTables = (orgId: string) => call<TableInfo[]>(orgId, '/tables')
export const tableByQr = (orgId: string, token: string) => call<TableInfo>(orgId, `/tables/by-qr/${encodeURIComponent(token)}`)
export const seatTable = (orgId: string, tableId: string, eventId: string) =>
  call<TableInfo>(orgId, `/tables/${encodeURIComponent(tableId)}/seat`, { method: 'POST', body: { eventId, deviceName: getDeviceName() } })
export const clearTable = (orgId: string, tableId: string) => call<TableInfo>(orgId, `/tables/${encodeURIComponent(tableId)}/clear`, { method: 'POST' })
// Table management (release D): move the guests, merge two tables' tabs, promise a table.
export const moveTable = (orgId: string, tableId: string, toTableId: string) => call<TableInfo>(orgId, `/tables/${encodeURIComponent(tableId)}/move`, { method: 'POST', body: { toTableId } })
export const mergeTable = (orgId: string, tableId: string, intoTableId: string) => call<TableInfo>(orgId, `/tables/${encodeURIComponent(tableId)}/merge`, { method: 'POST', body: { intoTableId } })
export const promiseTable = (orgId: string, tableId: string, promised: boolean) => call<TableInfo>(orgId, `/tables/${encodeURIComponent(tableId)}/promise`, { method: 'POST', body: { promised } })
export const listEvents = (orgId: string) => call<EventInfo[]>(orgId, '/events')
export const liveToken = (orgId: string) => call<{ token: string }>(orgId, '/live-token')

// Paying at the table (T4): a Bancontact QR on this phone, or a SumUp Solo
// the waiter carries. The tab's push says when it's paid.
// Tap to Pay (release E): `app` — the SumUp app on this phone, through sumupAppLink.
export async function startPayment(orgId: string, tabId: string, amountCents: number, method: 'bancontact' | 'sumup', readerId?: string, app = false) {
  const path = method === 'bancontact' ? '/api/bancontact/payments' : '/api/bancontact/sumup/charge'
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, tabId, amount: amountCents, deviceId: getDeviceId(), deviceName: getDeviceName(), ...(method === 'sumup' ? { method: 'sumup', ...(app ? { app: true } : { readerId }) } : {}) }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data as { chargeId: string; qrCodeUrl?: string; status?: string; sumupApp?: { affiliateKey: string; appId: string } }
}

// Back from the SumUp app: the backend checks the payment at SumUp now.
export async function sumupAppReturned(chargeId: string, status: string): Promise<{ status: 'pending' | 'succeeded' | 'failed'; errorMessage: string | null }> {
  const res = await fetch('/api/bancontact/sumup/app-return', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chargeId, status }) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data
}

// The org's SumUp Solo readers, and whether Tap to Pay (the SumUp app) is set up.
export async function listReaders(orgId: string): Promise<{ readers: { id: string; name: string }[]; tapToPay: boolean }> {
  const res = await fetch(`/api/bancontact/sumup/readers?org_id=${encodeURIComponent(orgId)}`)
  const data = await res.json().catch(() => null)
  return res.ok ? { readers: (data?.readers ?? []) as { id: string; name: string }[], tapToPay: data?.tapToPay === true } : { readers: [], tapToPay: false }
}

// The organisation's kassa channel (a waiter's phone is no device): tabs
// and tables changing elsewhere, and print jobs (a receipt for a printer this
// phone sends to). Reconnects by itself.
export function connectLive(orgId: string, onChange: () => void, onPrintJob?: (printerId: unknown) => void): () => void {
  let socket: WebSocket | null = null
  let stopped = false
  let delay = 1000
  const open = async () => {
    try {
      const { token } = await liveToken(orgId)
      if (stopped) return
      const url = new URL('/devices/connect', window.location.href)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set('token', token)
      socket = new WebSocket(url)
      socket.onopen = () => {
        delay = 1000
      }
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'tabs_changed' || msg.event === 'tables_changed') onChange()
          else if (msg.event === 'print_job') onPrintJob?.(msg.printer_id)
        } catch {
          // not ours
        }
      }
      socket.onclose = () => {
        if (!stopped) setTimeout(open, (delay = Math.min(delay * 2, 30_000)))
      }
    } catch {
      if (!stopped) setTimeout(open, (delay = Math.min(delay * 2, 30_000)))
    }
  }
  open()
  return () => {
    stopped = true
    socket?.close()
  }
}
