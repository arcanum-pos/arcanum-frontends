// Sales report (step 3d): client for arcanum-backend's
// /organizations/:orgId/reports/sales plus the pure helpers the Rapporten
// page uses (period bounds, labels). Revenue comes from order lines of
// closed tabs and excludes tips; payments come from the ledger
// (transactions), legacy pre-tab sales included. Helpers that produce
// text take the messages (messages/org) as their first argument.
import { apiErrorMessage } from '@/shared/api-errors'
import type { AdminOrgMessages } from '../messages/org/nl'
import { formatEuro } from './format'

export interface SalesReport {
  from: string
  to: string
  payments: {
    count: number
    amountCents: number
    tipCents: number
    byMethod: { method: string; count: number; amountCents: number; tipCents: number }[]
  }
  sales: {
    tabCount: number
    revenueCents: number
    byCategory: { category: string | null; quantity: number; revenueCents: number }[]
    byProduct: { name: string; category: string | null; quantity: number; revenueCents: number }[]
    byVat: { vatRateBp: number | null; revenueCents: number; vatCents: number }[]
  }
  legacy: { count: number; amountCents: number; items: Record<string, number> }
  openTabs: { count: number; outstandingCents: number }
}

// The error message for a 403 — a marker, never shown: the page says
// "alleen voor beheerders" (in the admin's language) instead of a raw
// error (useAsync keeps only the message).
export const REPORT_FORBIDDEN = 'reports:forbidden'

export async function fetchSalesReport(orgId: string, from: string, to: string): Promise<SalesReport> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/reports/sales?${params}`)
  if (res.status === 403) throw new Error(REPORT_FORBIDDEN)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data as SalesReport
}

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

// "YYYY-MM-DD" (a date input's value) → local midnight, or null.
function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Period → [from, to) as ISO instants, computed in the browser's local
// time (Europe/Brussels in practice): days run midnight to midnight, a
// week starts on Monday, `to` is the exclusive next midnight. A custom
// period covers both chosen days fully; null when it's incomplete or
// reversed.
export function periodBounds(period: Period, now: Date, custom?: { from: string; to: string }): { from: string; to: string } | null {
  const today = startOfDay(now)
  let from: Date
  let to: Date
  switch (period) {
    case 'today':
      from = today
      to = addDays(today, 1)
      break
    case 'yesterday':
      from = addDays(today, -1)
      to = today
      break
    case 'week': {
      const sinceMonday = (today.getDay() + 6) % 7
      from = addDays(today, -sinceMonday)
      to = addDays(from, 7)
      break
    }
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      to = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      break
    case 'custom': {
      const a = custom ? parseDateInput(custom.from) : null
      const b = custom ? parseDateInput(custom.to) : null
      if (!a || !b || b < a) return null
      from = a
      to = addDays(b, 1)
      break
    }
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

export function methodLabel(m: Pick<AdminOrgMessages, 'methods'>, method: string): string {
  return (m.methods as Record<string, string>)[method] ?? method
}

// Basis points → "21%", "5,5%" (worded per language); null → not set yet
// (VAT per product is still provisional pending the accountant).
export function vatLabel(m: Pick<AdminOrgMessages, 'vatNotSet' | 'vatPercent'>, vatRateBp: number | null): string {
  if (vatRateBp === null) return m.vatNotSet
  return m.vatPercent(vatRateBp / 100)
}

// The old kassa's item keys (transactions.items, before tabs existed), in
// their usual order.
const LEGACY_KEYS = ['bon', 'fietstocht', 'fietstochtMember', 'wandeltocht', 'wandeltochtMember', 'fooi'] as const

// Known keys first in their usual order, then anything unknown as-is.
// Every value is a count, except fooi, which is an amount in cents.
export function legacyItemRows(m: Pick<AdminOrgMessages, 'legacyItems'>, items: Record<string, number>): { key: string; label: string; value: string }[] {
  const labels: Record<string, string> = m.legacyItems
  const known = LEGACY_KEYS.filter((k) => k in items)
  const unknown = Object.keys(items).filter((k) => !(k in labels)).sort()
  return [...known, ...unknown].map((key) => ({
    key,
    label: labels[key] ?? key,
    value: key === 'fooi' ? formatEuro(items[key]) : String(items[key]),
  }))
}
