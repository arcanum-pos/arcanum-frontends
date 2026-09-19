// Client for questo-bff's /api/organizations/* + /whoami — same contract
// webapp/src/lib/organizations.ts already uses. Works once this app is
// deployed behind questo-bff (same-origin, so cookies flow automatically);
// in local `npm run dev` it needs Vite's dev proxy (see vite.config.ts) to
// forward these to a real questo-bff dev server.

const ORGANIZATIONS_URL = '/api/organizations';
const DEVICES_URL = '/api/devices';
const WORKER_URL = '/api/bancontact';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORGANIZATIONS_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data && (data.error || data.details) ? [data.error, data.details].filter(Boolean).join(': ') : `status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export interface Organization {
  id: string
  name: string
  logoUrl: string | null
  theme: string | null
  slug: string | null
  createdAt: string
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

// Empty string clears the slug (falls back to the id-only link again).
export function setOrganizationSlug(orgId: string, slug: string): Promise<Organization> {
  return request(`/${encodeURIComponent(orgId)}/branding`, { method: 'PATCH', body: JSON.stringify({ slug }) })
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

export interface IdentityProviderConfig {
  connectionName: string | null
  issuerUrl: string | null
  clientId: string | null
  hasClientSecret: boolean
  scopes: string | null
  // Optional override client, used only for the authorization-code flow
  // (/login, /:orgId/console) — the device grant (/:orgId/device) always
  // uses clientId/hasClientSecret above. Null/unset: use those for both.
  authCodeClientId: string | null
  hasAuthCodeClientSecret: boolean
  updatedAt: string | null
}

export function getIdentityProvider(orgId: string): Promise<IdentityProviderConfig> {
  return request(`/${encodeURIComponent(orgId)}/identity-provider`)
}

export function setIdentityProvider(
  orgId: string,
  fields: {
    connectionName?: string
    issuerUrl?: string
    clientId?: string
    clientSecret?: string
    scopes?: string
    authCodeClientId?: string
    authCodeClientSecret?: string
  }
): Promise<IdentityProviderConfig> {
  return request(`/${encodeURIComponent(orgId)}/identity-provider`, { method: 'PUT', body: JSON.stringify(fields) })
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

// questo-bff's own top-level endpoint, not under /api/organizations.
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

// questo-devicehub, proxied at /api/devices — same contract as
// webapp/src/lib/terminal.ts's listOrgDevices/removeDevice.
export type DeviceRole = 'pos' | 'cfd' | 'sim'

export interface OrgDevice {
  terminal_id: string
  role: DeviceRole
  linked_to: string | null
  created_at: string
  // Live presence, display-only — an offline device is still fully
  // registered (and keeps any link it holds); removeDevice is the only
  // way a row actually goes away. See questo-devicehub's identity_providers
  // design note in CLAUDE.md for why presence never auto-deletes.
  online: boolean
}

export async function listOrgDevices(orgId: string): Promise<OrgDevice[]> {
  const res = await fetch(`${DEVICES_URL}/by-org/${encodeURIComponent(orgId)}`)
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}

export async function removeDevice(terminalId: string): Promise<void> {
  const res = await fetch(`${DEVICES_URL}/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terminal_id: terminalId }),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
}

// worker's shared transactions ledger, proxied at /api/bancontact — same
// contract as webapp/src/scripts/transactions.ts. That page also does a
// lot of event-specific reporting (bonnen/fietstocht/wandeltocht/fooi
// counts, tijdvak/slot filtering) tied to one event's own item taxonomy —
// deliberately not ported here; this is just the plain list for now.
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
