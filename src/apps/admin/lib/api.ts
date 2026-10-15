// Client for arcanum-bff's /api/organizations/* + /whoami — same contract
// webapp/src/lib/organizations.ts already uses. Works once this app is
// deployed behind arcanum-bff (same-origin, so cookies flow automatically);
// in local `npm run dev` it needs Vite's dev proxy (see vite.config.ts) to
// forward these to a real arcanum-bff dev server.
import { apiErrorMessage } from '@/shared/api-errors'
import type { Locale } from '@/shared/i18n'

const ORGANIZATIONS_URL = '/api/organizations';
const WORKER_URL = '/api/bancontact';

// Exported for sibling clients (catalog-api.ts) that talk to the same
// /api/organizations prefix.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORGANIZATIONS_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = [apiErrorMessage(data, ''), data?.details].filter(Boolean).join(': ') || `status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export interface Organization {
  id: string
  name: string
  logoUrl: string | null
  theme: string | null
  createdAt: string
  // 'importing' while an org import (org-transfer.ts) isn't finished yet.
  importStatus?: string | null
  // The org's default language: its mails (the invite), and the language a
  // new kassa device starts in (chooser).
  locale?: Locale
  // Set for a demo org (is_locked = 'N'): when arcanum-cleaner deletes it,
  // and where to get an own installation.
  demo?: { expiresAt: string; installUrl: string | null } | null
}

// What the caller may do on this installation (arcanum-backend's
// ORG_CREATION: 'admins' | 'single' own instance | 'internal' demo instance).
export interface Capabilities {
  orgCreation: string
  canCreateOrganization: boolean
  canImportOrganization: boolean
  // One of the installation's own admins (the installer's admin list) — the
  // only ones who see the Installatie link. Absent: a backend from before it.
  instanceAdmin?: boolean
}

// An older backend without the endpoint: today's behaviour (both allowed,
// the backend still refuses what it must).
export async function getCapabilities(): Promise<Capabilities> {
  try {
    return await request<Capabilities>('/capabilities')
  } catch {
    return { orgCreation: 'admins', canCreateOrganization: true, canImportOrganization: true }
  }
}

export function listMyOrganizations(): Promise<Organization[]> {
  return request('')
}

export function createOrganization(name: string): Promise<Organization> {
  return request('', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getOrganization(orgId: string): Promise<Organization> {
  return request(`/${encodeURIComponent(orgId)}`)
}

export function setOrganizationLocale(orgId: string, locale: Locale): Promise<{ locale: Locale }> {
  return request(`/${encodeURIComponent(orgId)}/locale`, { method: 'PUT', body: JSON.stringify({ locale }) })
}

export interface Member {
  id: string
  userSub: string | null
  invitedEmail: string
  role: 'admin' | 'cashier' | 'waiter'
  status: 'pending' | 'active'
  invitedAt: string
  acceptedAt: string | null
}

export function listMembers(orgId: string): Promise<Member[]> {
  return request(`/${encodeURIComponent(orgId)}/members`)
}

// mailSent false: the installation sent no invite mail (none set up, or it
// failed) — the console then offers the invitation to pass on yourself.
export function inviteMember(orgId: string, email: string, role: 'admin' | 'cashier' | 'waiter'): Promise<Member & { mailSent?: boolean; loginUrl?: string }> {
  return request(`/${encodeURIComponent(orgId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function updateMemberRole(orgId: string, membershipId: string, role: 'admin' | 'cashier' | 'waiter'): Promise<Member> {
  return request(`/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function removeMember(orgId: string, membershipId: string): Promise<void> {
  return request(`/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, { method: 'DELETE' })
}

// The account a Bancontact key pays out to (arcanum-backend
// bancontact-account.ts), or a SumUp merchant code's account (no IBAN).
export interface BancontactAccount {
  merchantId: string
  name: string | null
  // Masked: country and last four digits.
  iban?: string | null
  // SumUp: a sandbox (test) merchant, per its profile; null when it doesn't say.
  sandbox?: boolean | null
}

export interface PaymentCredential {
  provider: 'bancontact' | 'sumup'
  configured: boolean
  updatedAt: string
  // Bancontact: the confirmed account (null: saved before that was checked).
  environment?: 'prod' | 'preprod' | null
  account?: BancontactAccount | null
}

export function listPaymentCredentials(orgId: string): Promise<PaymentCredential[]> {
  return request(`/${encodeURIComponent(orgId)}/payment-credentials`)
}

export function setPaymentCredential(
  orgId: string,
  provider: PaymentCredential['provider'],
  config: Record<string, unknown>
): Promise<PaymentCredential> {
  return request(`/${encodeURIComponent(orgId)}/payment-credentials/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

// Saving a Bancontact or SumUp key: first its account comes back to confirm
// (`confirm`), then — with confirmMerchantId — it's kept (`saved`).
export async function savePaymentKey(
  orgId: string,
  provider: PaymentCredential['provider'],
  config: { apiKey: string; environment?: string; merchantId?: string; confirmMerchantId?: string }
): Promise<{ saved: true } | { confirm: BancontactAccount }> {
  const res = await fetch(`${ORGANIZATIONS_URL}/${encodeURIComponent(orgId)}/payment-credentials/${provider}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = await res.json().catch(() => null)
  if (res.ok) return { saved: true }
  if (res.status === 409 && (data?.code === 'bancontact_confirm_account' || data?.code === 'sumup_confirm_account') && data.account) return { confirm: data.account as BancontactAccount }
  const message = [apiErrorMessage(data, ''), data?.detail].filter(Boolean).join(': ') || `status ${res.status}`
  throw new Error(message)
}

// worker's /sumup/readers (payments/sumup.ts) — not under /organizations,
// so it goes through WORKER_URL like transactions, not the generic
// `request` helper. Fetched live from SumUp on every call, nothing cached:
// a reader removed from the SumUp account just disappears here too.
export interface SumupReader {
  id: string
  name: string
  status: string // unknown | processing | paired | expired
  model: string | null // solo | virtual-solo
}

export async function listSumupReaders(orgId: string): Promise<{ configured: boolean; readers: SumupReader[]; error?: string }> {
  // Always returns a well-formed body, even on its own 502 (a live SumUp API
  // failure) — that's this org's "readers" state, not a transport error, so
  // the caller reads `error` off the body instead of a thrown exception.
  const res = await fetch(`${WORKER_URL}/sumup/readers?org_id=${encodeURIComponent(orgId)}`)
  return res.json()
}

async function workerCall(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${WORKER_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, '') || `status ${res.status}`)
  return data
}

// Pairs a reader with the org's SumUp account by the code the Solo (or the
// Virtual Solo) shows; it stays 'processing' until the device confirms.
export async function pairSumupReader(orgId: string, pairingCode: string, name: string): Promise<SumupReader> {
  const data = await workerCall('/sumup/readers', { method: 'POST', body: JSON.stringify({ orgId, pairingCode, name }) })
  return data.reader
}

export async function removeSumupReader(orgId: string, readerId: string): Promise<void> {
  await workerCall(`/sumup/readers/${encodeURIComponent(readerId)}?org_id=${encodeURIComponent(orgId)}`, { method: 'DELETE' })
}

export interface Whoami {
  sub: string
  email: string
  name: string
  firstName: string
  lastName: string
  username: string
}

export async function whoami(): Promise<Whoami> {
  const res = await fetch('/whoami')
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}

// The organisation's devices and their pairing codes — arcanum-backend's
// devices.ts (it checks the role, then asks arcanum-devicehub).
// 'sim': the SumUp simulator, removed 2026-10-06 — only still listed so an
// old registration can be recognised and removed.
// 'station': a station screen (one prep station's tickets).
export type DeviceRole = 'pos' | 'cfd' | 'station' | 'sim'

export interface OrgDevice {
  terminal_id: string
  role: DeviceRole
  linked_to: string | null
  created_at: string
  // From its pairing code, or renamed since; null for an older device.
  name: string | null
  // Live presence, display-only — an offline device is still fully
  // registered (and keeps any link it holds); removeDevice is the only
  // way a row actually goes away.
  online: boolean
  // A station screen's station, and its kind: 'pickup' = the pickup screen for guests.
  station_id?: string
  station_name?: string | null
  view?: 'pickup' | 'tables' | null
}

export async function setDeviceStation(orgId: string, terminalId: string, stationId: string): Promise<void> {
  await request(`/${encodeURIComponent(orgId)}/devices/${encodeURIComponent(terminalId)}`, { method: 'PATCH', body: JSON.stringify({ stationId }) })
}

export function listOrgDevices(orgId: string): Promise<OrgDevice[]> {
  return request(`/${encodeURIComponent(orgId)}/devices`)
}

export async function removeDevice(orgId: string, terminalId: string): Promise<void> {
  await request(`/${encodeURIComponent(orgId)}/devices/${encodeURIComponent(terminalId)}`, { method: 'DELETE' })
}

export async function renameOrgDevice(orgId: string, terminalId: string, name: string): Promise<void> {
  await request(`/${encodeURIComponent(orgId)}/devices/${encodeURIComponent(terminalId)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export interface DevicePairing {
  id: string
  role: 'pos' | 'cfd' | 'station'
  name: string
  status: 'open' | 'claimed' | 'revoked' | 'expired'
  createdBy: string
  createdAt: string
  expiresAt: string
  claimedAt: string | null
  claimedBy: string | null
  terminalId: string | null
  linkTo: string | null
  view?: 'pickup' | 'tables' | null
  // Only in the answer to createDevicePairing — never stored readable.
  code?: string
}

// `linkTo`: for a customer display, the kassa it's for — linked as soon as it's paired.
// `stationId`: for a station screen, the prep station it shows; `view`
// 'pickup': it's the pickup screen for guests (only order numbers).
export function createDevicePairing(orgId: string, role: 'pos' | 'cfd' | 'station', name: string, linkTo?: string | null, stationId?: string | null, view?: 'pickup' | 'tables' | null): Promise<DevicePairing & { code: string }> {
  return request(`/${encodeURIComponent(orgId)}/device-pairings`, {
    method: 'POST',
    body: JSON.stringify({ role, name, linkTo: role === 'cfd' ? linkTo || null : null, stationId: role === 'station' ? stationId || null : null, ...(role === 'station' && view ? { view } : {}) }),
  })
}

export function listDevicePairings(orgId: string): Promise<DevicePairing[]> {
  return request(`/${encodeURIComponent(orgId)}/device-pairings`)
}

export async function revokeDevicePairing(orgId: string, id: string): Promise<void> {
  await request(`/${encodeURIComponent(orgId)}/device-pairings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// worker's shared transactions ledger (one row per recorded payment),
// proxied at /api/bancontact — members of the org only. Aggregated sales
// reporting lives in reports.ts (the /reports/sales endpoint).
export interface Transaction {
  id: string
  amountCents: number
  description: string
  method: string
  items: Record<string, number>
  slotId: string | null
  deviceId: string | null
  deviceName: string | null
  userName: string | null
  userEmail: string | null
  eventId: string | null
  // Part of amountCents: paid by the customer, not revenue (since step 3d).
  tipCents: number
  tabId: string | null
  completedAt: string
}

export async function listTransactions(orgId: string, eventId?: string): Promise<Transaction[]> {
  const params = new URLSearchParams({ orgId })
  if (eventId) params.set('eventId', eventId)
  const res = await fetch(`${WORKER_URL}/transactions?${params}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}

// The org's events (arcanum-backend organizations/events.ts): name + date,
// what tabs and sales are tagged with — plus an event's self-ordering (on/off,
// the code in its public URL/QR), its ordering modes (bestelwijzen) and its
// own short order numbers (DOMAIN_MODEL.md "Self-ordering and station screens").
export interface OrderMode {
  id: string
  name: string
  catalogId: string | null
  // Guests order with it themselves, with the event's QR code.
  selfOrder: boolean
  // With the QR: how guests pay, and ordering on their tab.
  payAtCounter: boolean
  payBancontact: boolean
  tabs: boolean
  // An SMS to the guest when a station's part is ready (MESSAGING.md).
  notifySms?: boolean
  // On a tab: opening it asks a name and a mobile number or e-mail.
  tabContact?: boolean
  // Waiters take orders at the table with it (release C): its menu is theirs.
  atTable?: boolean
}

export interface Event {
  id: string
  name: string
  date: string
  createdAt: string
  // code: what goes in the link and QR (readable: <name>-<4 characters>); linkName: its name part.
  selfOrder?: { enabled: boolean; code: string | null; linkName?: string | null }
  modes?: OrderMode[]
  // Whether this installation can send SMS (installer → Geavanceerd → Sms).
  sms?: boolean
  // The kassa shows the ordering modes and labels a new order with the one chosen (off by default).
  kassaModes?: boolean
  // The last order number given out (0: the next is #1).
  lastOrderNumber?: number
}

export function updateEvent(orgId: string, eventId: string, fields: { name?: string; date?: string; selfOrderEnabled?: boolean; linkName?: string; kassaModes?: boolean }): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(fields) })
}

export type OrderModeFields = Partial<Omit<OrderMode, 'id'>> & { move?: 'up' | 'down' }

export function createOrderMode(orgId: string, eventId: string, fields: OrderModeFields & { name: string }): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/modes`, { method: 'POST', body: JSON.stringify(fields) })
}

export function updateOrderMode(orgId: string, eventId: string, modeId: string, fields: OrderModeFields): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/modes/${encodeURIComponent(modeId)}`, { method: 'PATCH', body: JSON.stringify(fields) })
}

export function deleteOrderMode(orgId: string, eventId: string, modeId: string): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/modes/${encodeURIComponent(modeId)}`, { method: 'DELETE' })
}

export function newSelfOrderCode(orgId: string, eventId: string): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/self-order-code`, { method: 'POST' })
}

export function resetEventNumbers(orgId: string, eventId: string): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/reset-numbers`, { method: 'POST' })
}

export function listEvents(orgId: string): Promise<Event[]> {
  return request(`/${encodeURIComponent(orgId)}/events`)
}

export function createEvent(orgId: string, fields: { name: string; date: string }): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events`, { method: 'POST', body: JSON.stringify(fields) })
}

// --- Staff (Medewerkers, release B1) ---

export interface StaffRecord {
  id: string
  name: string
  hasPin: boolean
  memberId: string | null
  archived: boolean
  createdAt: string
}

export function listAllStaff(orgId: string): Promise<{ required: boolean; staff: StaffRecord[] }> {
  return request(`/${encodeURIComponent(orgId)}/staff?all=1`)
}

export function createStaff(orgId: string, name: string, pin?: string): Promise<StaffRecord> {
  return request(`/${encodeURIComponent(orgId)}/staff`, { method: 'POST', body: JSON.stringify({ name, ...(pin ? { pin } : {}) }) })
}

export function updateStaff(orgId: string, staffId: string, changes: { name?: string; pin?: string | null; archived?: boolean }): Promise<StaffRecord> {
  return request(`/${encodeURIComponent(orgId)}/staff/${encodeURIComponent(staffId)}`, { method: 'PATCH', body: JSON.stringify(changes) })
}

export function setStaffRequired(orgId: string, required: boolean): Promise<{ required: boolean }> {
  return request(`/${encodeURIComponent(orgId)}/staff-settings`, { method: 'PUT', body: JSON.stringify({ required }) })
}

// --- Kassalades and shifts (release B2) ---

export interface RegisterRecord {
  id: string
  name: string
  archived: boolean
  open: boolean
}

export interface ShiftRecord {
  id: string
  number: number
  registerId: string
  registerName: string
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string | null
  closedAt: string | null
  closedBy: string | null
  openingFloatCents: number
  expectedCents: number | null
  countedCents: number | null
  differenceCents: number | null
  note: string | null
}

export function listRegistersAdmin(orgId: string): Promise<{ blindCount: boolean; registers: RegisterRecord[] }> {
  return request(`/${encodeURIComponent(orgId)}/registers`)
}

export function createRegister(orgId: string, name: string): Promise<RegisterRecord> {
  return request(`/${encodeURIComponent(orgId)}/registers`, { method: 'POST', body: JSON.stringify({ name }) })
}

export function updateRegister(orgId: string, registerId: string, changes: { name?: string; archived?: boolean }): Promise<RegisterRecord> {
  return request(`/${encodeURIComponent(orgId)}/registers/${encodeURIComponent(registerId)}`, { method: 'PATCH', body: JSON.stringify(changes) })
}

export function setBlindCount(orgId: string, blindCount: boolean): Promise<{ blindCount: boolean }> {
  return request(`/${encodeURIComponent(orgId)}/shift-settings`, { method: 'PUT', body: JSON.stringify({ blindCount }) })
}

export function listShifts(orgId: string): Promise<ShiftRecord[]> {
  return request(`/${encodeURIComponent(orgId)}/shifts`)
}

// --- Tafels (release C) ---

export interface TableRecord {
  id: string
  name: string
  zone: string | null
  position: number
  archived: boolean
  state: 'free' | 'occupied' | 'clearing'
  qrToken: string | null
}

export function listTablesAdmin(orgId: string): Promise<TableRecord[]> {
  return request(`/${encodeURIComponent(orgId)}/tables`)
}

export function createTable(orgId: string, name: string, zone: string | null): Promise<TableRecord> {
  return request(`/${encodeURIComponent(orgId)}/tables`, { method: 'POST', body: JSON.stringify({ name, zone }) })
}

export function updateTable(orgId: string, tableId: string, changes: { name?: string; zone?: string | null; archived?: boolean }): Promise<TableRecord> {
  return request(`/${encodeURIComponent(orgId)}/tables/${encodeURIComponent(tableId)}`, { method: 'PATCH', body: JSON.stringify(changes) })
}

export function newTableQr(orgId: string, tableId: string): Promise<TableRecord> {
  return request(`/${encodeURIComponent(orgId)}/tables/${encodeURIComponent(tableId)}/new-qr`, { method: 'POST' })
}
