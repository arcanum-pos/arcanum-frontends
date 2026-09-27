// Thin client for arcanum-backend's tabs API (/organizations/:orgId/tabs,
// see arcanum-backend/src/tabs.ts). Tabs live on the server and belong to
// the org, so every kassa of the org sees the same open tabs — this module
// just fetches; the server enforces every rule (open, no payment pending,
// amount at most what's outstanding).
import { getDeviceId, getDeviceName } from '@/shared/device'
import { apiErrorMessage, isApiErrorCode, type ApiErrorCode } from '@/shared/api-errors'
import type { KassaMessages } from './messages/nl'

export interface TabSummary {
  id: string
  number: number
  label: string
  eventId?: string | null
  eventName?: string | null
  status: 'open' | 'closed' | 'cancelled'
  openedDeviceName: string | null
  openedByName?: string | null
  openedAt: string
  closedAt?: string | null
  cancelReason?: string | null
  receiptNumber: number | null
  totalCents: number
  paidCents: number
  outstandingCents: number
  paymentPending: boolean
  // "Gelijk verdelen" in progress: parts in the plan, how many are paid,
  // and what the next part is (the last one takes the rounding).
  split?: TabSplit | null
  // The methods it was paid with (succeeded charges, first paid first).
  methods?: string[]
  // Units still on it, net of voids.
  itemCount?: number
}

// A charge on the tab, as the detail lists it.
export interface TabPayment {
  id: string
  method: string
  status: 'pending' | 'succeeded' | 'failed'
  amountCents: number
  tipCents: number
  deviceName: string | null
  userName: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface TabSplit {
  parts: number
  paid: number
  nextCents: number
}

export interface TabLine {
  id: string
  orderId: string
  itemCode: string | null
  name: string
  unitPriceCents: number
  quantity: number
  voidsLineId: string | null
  voidReason: string | null
  voidedQuantity: number
  // Units already paid by an item payment (split per item).
  paidQuantity?: number
  createdAt: string
}

export interface TabDetail extends TabSummary {
  lines: TabLine[]
  payments?: TabPayment[]
}

// A line as the kassa builds it, before it's submitted as part of an order.
// With a variantId it's a catalog line: only variantId + quantity are sent
// and the server prices it; name/price here are for display. Without one
// it's a free line (fooi) sent as-is.
export interface DraftLine {
  itemCode: string | null
  name: string
  unitPriceCents: number
  quantity: number
  // Every line comes from the catalog (free lines are refused since 3d).
  variantId: string
}

// Carries the server's own error message (already Dutch, user-facing) and,
// for a 409, the tab's current state so the caller can refresh from it.
// `code`: the backend's error code, when it sent one (see shared/api-errors).
export class TabApiError extends Error {
  readonly status: number
  readonly tab?: TabSummary
  readonly code?: ApiErrorCode

  constructor(message: string, status: number, tab?: TabSummary, code?: ApiErrorCode) {
    super(message)
    this.status = status
    this.tab = tab
    this.code = code
  }

  static fromResponse(status: number, data: any, fallback: string): TabApiError {
    return new TabApiError(apiErrorMessage(data, fallback), status, data?.tab, isApiErrorCode(data?.code) ? data.code : undefined)
  }
}

async function request<T>(orgId: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/tabs${path}`, {
    method: init?.method || 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw TabApiError.fromResponse(res.status, data, `Fout ${res.status}`)
  return data as T
}

function device() {
  return { deviceId: getDeviceId(), deviceName: getDeviceName() }
}

export function toLineInputs(lines: DraftLine[]) {
  return lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
}

export function listOpenTabs(orgId: string) {
  return request<TabSummary[]>(orgId, '?status=open')
}

// Every tab opened or closed since `since`, plus those still open, of every
// kassa of the org — the Rekeningen overview ("vandaag").
export function listTabsSince(orgId: string, since: string) {
  return request<TabSummary[]>(orgId, `?status=all&since=${encodeURIComponent(since)}`)
}

export function getTab(orgId: string, tabId: string) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}`)
}

// catalogId: the catalog the draft's catalog lines were picked from — the
// server prices them from it.
// eventId: the kassa's chosen event (Instellingen → Evenement), if any —
// tags the tab and every sale paid on it.
export function createTab(orgId: string, label: string, slotId: string, lines: DraftLine[] = [], catalogId: string | null = null, eventId: string | null = null) {
  return request<TabDetail>(orgId, '', {
    method: 'POST',
    body: { label, slotId, ...device(), lines: lines.length > 0 ? toLineInputs(lines) : undefined, catalogId: catalogId || undefined, eventId: eventId || undefined },
  })
}

export function addOrder(orgId: string, tabId: string, lines: DraftLine[], catalogId: string | null) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}/orders`, {
    method: 'POST',
    body: { ...device(), lines: toLineInputs(lines), catalogId: catalogId || undefined },
  })
}

export function voidLine(orgId: string, tabId: string, lineId: string, reason: string, quantity?: number) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}/lines/${encodeURIComponent(lineId)}/void`, {
    method: 'POST',
    body: { ...device(), reason, quantity },
  })
}

export function renameTab(orgId: string, tabId: string, label: string) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}`, { method: 'PATCH', body: { label } })
}

// Split what's open now into `parts` equal payments; null stops splitting.
export function setSplit(orgId: string, tabId: string, parts: number | null) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}/split`, { method: 'POST', body: { parts } })
}

export function cancelTab(orgId: string, tabId: string, reason?: string) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}/cancel`, { method: 'POST', body: { reason } })
}

// A Toog sale's tab is stored under this name in every language — the
// customer display recognises it (shared/customer-order.ts) — and is only
// shown translated.
export const QUICK_SALE_LABEL = 'Toog'

export function tabTitle(m: Pick<KassaMessages, 'quickSale' | 'tabNumber'>, tab: Pick<TabSummary, 'number' | 'label'>): string {
  if (!tab.label) return m.tabNumber(tab.number)
  return `#${tab.number} ${tab.label === QUICK_SALE_LABEL ? m.quickSale : tab.label}`
}

// Net quantity still on the tab for an original (non-void) line.
export function netQuantity(line: TabLine): number {
  return line.quantity - line.voidedQuantity
}
