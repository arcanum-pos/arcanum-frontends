// Thin client for arcanum-backend's tabs API (/organizations/:orgId/tabs,
// see arcanum-backend/src/tabs.ts). Tabs live on the server and belong to
// the org, so every kassa of the org sees the same open tabs — this module
// just fetches; the server enforces every rule (open, no payment pending,
// amount = outstanding).
import { getDeviceId, getDeviceName } from '@/shared/device'

export interface TabSummary {
  id: string
  number: number
  label: string
  status: 'open' | 'closed' | 'cancelled'
  openedDeviceName: string | null
  openedAt: string
  receiptNumber: number | null
  totalCents: number
  paidCents: number
  outstandingCents: number
  paymentPending: boolean
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
  createdAt: string
}

export interface TabDetail extends TabSummary {
  lines: TabLine[]
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
export class TabApiError extends Error {
  readonly status: number
  readonly tab?: TabSummary

  constructor(message: string, status: number, tab?: TabSummary) {
    super(message)
    this.status = status
    this.tab = tab
  }
}

async function request<T>(orgId: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/tabs${path}`, {
    method: init?.method || 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new TabApiError(data.error || `Fout ${res.status}`, res.status, data.tab)
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

export function getTab(orgId: string, tabId: string) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}`)
}

// catalogId: the catalog the draft's catalog lines were picked from — the
// server prices them from it.
export function createTab(orgId: string, label: string, slotId: string, lines: DraftLine[] = [], catalogId: string | null = null) {
  return request<TabDetail>(orgId, '', {
    method: 'POST',
    body: { label, slotId, ...device(), lines: lines.length > 0 ? toLineInputs(lines) : undefined, catalogId: catalogId || undefined },
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

export function cancelTab(orgId: string, tabId: string, reason?: string) {
  return request<TabDetail>(orgId, `/${encodeURIComponent(tabId)}/cancel`, { method: 'POST', body: { reason } })
}

export function tabTitle(tab: Pick<TabSummary, 'number' | 'label'>): string {
  return tab.label ? `#${tab.number} ${tab.label}` : `Rekening #${tab.number}`
}

// Net quantity still on the tab for an original (non-void) line.
export function netQuantity(line: TabLine): number {
  return line.quantity - line.voidedQuantity
}
