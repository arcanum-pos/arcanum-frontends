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
  role: 'admin' | 'cashier'
  status: 'pending' | 'active'
  invitedAt: string
  acceptedAt: string | null
}

export function listMembers(orgId: string): Promise<Member[]> {
  return request(`/${encodeURIComponent(orgId)}/members`)
}

export function inviteMember(orgId: string, email: string, role: 'admin' | 'cashier'): Promise<Member> {
  return request(`/${encodeURIComponent(orgId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function updateMemberRole(orgId: string, membershipId: string, role: 'admin' | 'cashier'): Promise<Member> {
  return request(`/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function removeMember(orgId: string, membershipId: string): Promise<void> {
  return request(`/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, { method: 'DELETE' })
}

export interface PaymentCredential {
  provider: 'bancontact' | 'sumup'
  configured: boolean
  updatedAt: string
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

export interface SmtpCredentialsConfig {
  host: string | null
  port: number | null
  username: string | null
  fromAddress: string | null
  fromName: string | null
  hasPassword: boolean
  updatedAt: string | null
}

export function getSmtpCredentials(orgId: string): Promise<SmtpCredentialsConfig> {
  return request(`/${encodeURIComponent(orgId)}/smtp-credentials`)
}

export function setSmtpCredentials(
  orgId: string,
  fields: { host?: string; port?: number; username?: string; password?: string; fromAddress?: string; fromName?: string }
): Promise<SmtpCredentialsConfig> {
  return request(`/${encodeURIComponent(orgId)}/smtp-credentials`, { method: 'PUT', body: JSON.stringify(fields) })
}

export function sendTestEmail(orgId: string): Promise<{ ok: true; provider: MailProvider }> {
  return request(`/${encodeURIComponent(orgId)}/smtp-credentials/test`, { method: 'POST' })
}

export type MailProvider = 'smtp' | 'gmail_api'

export function getMailProvider(orgId: string): Promise<{ provider: MailProvider }> {
  return request(`/${encodeURIComponent(orgId)}/mail-provider`)
}

export function setMailProvider(orgId: string, provider: MailProvider): Promise<{ provider: MailProvider }> {
  return request(`/${encodeURIComponent(orgId)}/mail-provider`, { method: 'PUT', body: JSON.stringify({ provider }) })
}

export interface GmailApiCredentialsConfig {
  clientEmail: string | null
  impersonatedUser: string | null
  fromName: string | null
  hasPrivateKey: boolean
  updatedAt: string | null
}

export function getGmailApiCredentials(orgId: string): Promise<GmailApiCredentialsConfig> {
  return request(`/${encodeURIComponent(orgId)}/gmail-api-credentials`)
}

export function setGmailApiCredentials(
  orgId: string,
  fields: { clientEmail?: string; privateKey?: string; impersonatedUser?: string; fromName?: string }
): Promise<GmailApiCredentialsConfig> {
  return request(`/${encodeURIComponent(orgId)}/gmail-api-credentials`, { method: 'PUT', body: JSON.stringify(fields) })
}

// arcanum-bff's own top-level endpoint, not under /api/organizations.
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
export type DeviceRole = 'pos' | 'cfd' | 'sim'

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
  role: 'pos' | 'cfd'
  name: string
  status: 'open' | 'claimed' | 'revoked' | 'expired'
  createdBy: string
  createdAt: string
  expiresAt: string
  claimedAt: string | null
  claimedBy: string | null
  terminalId: string | null
  linkTo: string | null
  // Only in the answer to createDevicePairing — never stored readable.
  code?: string
}

// `linkTo`: for a customer display, the kassa it's for — linked as soon as it's paired.
export function createDevicePairing(orgId: string, role: 'pos' | 'cfd', name: string, linkTo?: string | null): Promise<DevicePairing & { code: string }> {
  return request(`/${encodeURIComponent(orgId)}/device-pairings`, { method: 'POST', body: JSON.stringify({ role, name, linkTo: role === 'cfd' ? linkTo || null : null }) })
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

// worker's per-org events (organizations/events.ts) — first step only:
// name + date, and something transactions can be tagged with. Doesn't
// drive kassa menus/catalogues yet.
export interface Event {
  id: string
  name: string
  date: string
  createdAt: string
}

export function listEvents(orgId: string): Promise<Event[]> {
  return request(`/${encodeURIComponent(orgId)}/events`)
}

export function createEvent(orgId: string, fields: { name: string; date: string }): Promise<Event> {
  return request(`/${encodeURIComponent(orgId)}/events`, { method: 'POST', body: JSON.stringify(fields) })
}
