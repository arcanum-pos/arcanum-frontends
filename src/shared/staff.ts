// Who's working on this shared device (kassa, station screen) — DOMAIN_MODEL.md
// "Staff on shared devices" (release B1). The chosen person is kept on the
// device (S1: until someone switches) with the signed token the backend gave
// for them; every request that does something sends it as X-Staff, and the
// backend records the person from that token alone.
import { apiErrorMessage } from './api-errors'

const KEY = 'arcanum-staff'

export interface StaffMember {
  id: string
  name: string
  hasPin: boolean
}

export interface ChosenStaff {
  orgId: string
  id: string
  name: string
  token: string
}

const listeners = new Set<() => void>()

export function chosenStaff(orgId: string | null | undefined): ChosenStaff | null {
  if (!orgId) return null
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as ChosenStaff | null
    return value && value.orgId === orgId && value.token ? value : null
  } catch {
    return null
  }
}

export function setChosenStaff(value: ChosenStaff | null): void {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch {
    // not kept: chosen again after a reload
  }
  listeners.forEach((l) => l())
}

export function onStaffChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The header to send with what this device does — nothing without a person.
export function staffHeaders(orgId: string | null | undefined): Record<string, string> {
  const staff = chosenStaff(orgId)
  return staff ? { 'X-Staff': staff.token } : {}
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { code: data?.code as string | undefined })
  return data as T
}

export function listStaff(orgId: string): Promise<{ required: boolean; staff: StaffMember[] }> {
  return call(`/api/organizations/${encodeURIComponent(orgId)}/staff`)
}

// Chooses a person on this device: their token (after the PIN, if they have one).
export async function chooseStaff(orgId: string, member: StaffMember, pin?: string): Promise<ChosenStaff> {
  const { token, staff } = await call<{ token: string; staff: { id: string; name: string } }>(
    `/api/organizations/${encodeURIComponent(orgId)}/staff/${encodeURIComponent(member.id)}/token`,
    { method: 'POST', body: JSON.stringify(pin ? { pin } : {}) }
  )
  const chosen = { orgId, id: staff.id, name: staff.name, token }
  setChosenStaff(chosen)
  return chosen
}
