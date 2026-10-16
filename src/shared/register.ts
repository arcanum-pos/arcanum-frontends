// Registers and shifts (DOMAIN_MODEL.md "Registers, shifts and kasopmaak",
// release B2). A kassa picks its register (cash drawer) in Instellingen;
// from then on it sells only while that register's shift is open, and does
// the kasopmaak at the end. Without a register it sells as before.
import { apiErrorMessage } from './api-errors'
import { staffHeaders } from './staff'

const KEY = 'arcanum-register'

export interface RegisterChoice {
  orgId: string
  id: string
  name: string
}

export function getRegister(orgId: string | null | undefined): RegisterChoice | null {
  if (!orgId) return null
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as RegisterChoice | null
    return value && value.orgId === orgId ? value : null
  } catch {
    return null
  }
}

export function setRegister(choice: RegisterChoice | null): void {
  try {
    if (choice) localStorage.setItem(KEY, JSON.stringify(choice))
    else localStorage.removeItem(KEY)
  } catch {
    // not kept on this browser
  }
}

export interface Register {
  id: string
  name: string
  archived: boolean
  open: boolean
}

export interface ShiftTotals {
  methods: Record<string, { count: number; cents: number; tipCents: number }>
  cashIn: number
  cashOut: number
}

export interface Shift {
  id: string
  registerId: string
  number: number
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string | null
  openingFloatCents: number
  totals: ShiftTotals
  movements: { direction: 'in' | 'out'; amountCents: number; reason: string; by: string | null; at: string }[]
  // null while open with blind count on.
  expectedCents: number | null
  pendingPayments?: number
  openTabs?: number
  closedAt?: string
  closedBy?: string | null
  countedCents?: number
  differenceCents?: number
  note?: string | null
  leftInDrawerCents?: number
  // Who worked on it: who took payments (how many), opened, closed or moved cash.
  people?: ShiftPerson[]
}

export interface ShiftPerson {
  name: string
  payments: number
}

// "Bert (2) · Barbara (1)": the people on a shift, with their payments.
export function peopleLine(people: ShiftPerson[] | undefined): string {
  return (people ?? []).map((p) => (p.payments ? `${p.name} (${p.payments})` : p.name)).join(' · ')
}

export interface RegisterState {
  register: { id: string; name: string; archived: boolean }
  shift: Shift | null
  suggestedFloatCents: number | null
  blindCount: boolean
}

// Euro notes and coins, in cents, largest first — the count's rows.
export const DENOMINATIONS = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

export type Count = Record<string, number>

export const countTotal = (count: Count) => Object.entries(count).reduce((sum, [d, n]) => sum + Number(d) * (n || 0), 0)

async function call<T>(orgId: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...staffHeaders(orgId) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { code: data?.code as string | undefined })
  return data as T
}

export const listRegisters = (orgId: string) => call<{ blindCount: boolean; registers: Register[] }>(orgId, '/registers')
export const registerState = (orgId: string, registerId: string) => call<RegisterState>(orgId, `/registers/${encodeURIComponent(registerId)}/shift`)
export const openShift = (orgId: string, registerId: string, body: { floatCents?: number; count?: Count }) =>
  call<Shift>(orgId, `/registers/${encodeURIComponent(registerId)}/shift`, { method: 'POST', body })
export const addMovement = (orgId: string, shiftId: string, body: { direction: 'in' | 'out'; amountCents: number; reason: string; deviceName?: string }) =>
  call<Shift>(orgId, `/shifts/${encodeURIComponent(shiftId)}/movements`, { method: 'POST', body })
export const closeShift = (orgId: string, shiftId: string, body: { count?: Count; countedCents?: number; note?: string; leftInDrawerCents: number }) =>
  call<Shift>(orgId, `/shifts/${encodeURIComponent(shiftId)}/close`, { method: 'POST', body })
