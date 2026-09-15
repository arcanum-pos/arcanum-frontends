// Placeholder data only — this app isn't wired to questo-bff/worker's real
// /api/organizations/* API yet (that needs this Worker deployed behind
// questo-bff first, so session cookies/org context actually exist). Shapes
// here deliberately mirror the real API responses (see worker/src/organizations/
// and webapp/src/lib/organizations.ts) so swapping this for a real fetch()
// later is a like-for-like replacement, not a redesign.

export interface MockOrg {
  id: string
  name: string
}

export const mockOrgs: MockOrg[] = [
  { id: 'elewijtse-pijl', name: 'Elewijtse Pijl 2026' },
  { id: 'scouts-elewijt', name: 'Scouts Elewijt' },
]

export interface MockMember {
  id: string
  invitedEmail: string
  role: 'admin' | 'cashier'
  status: 'pending' | 'active'
}

export const mockMembers: MockMember[] = [
  { id: '1', invitedEmail: 'bert@kaboutersoft.be', role: 'admin', status: 'active' },
  { id: '2', invitedEmail: 'leiding@scoutselewijt.be', role: 'cashier', status: 'active' },
  { id: '3', invitedEmail: 'nieuw.lid@scoutselewijt.be', role: 'cashier', status: 'pending' },
]

export interface MockPaymentCredential {
  provider: 'bancontact' | 'sumup'
  configured: boolean
  updatedAt: string | null
}

export const mockPaymentCredentials: MockPaymentCredential[] = [
  { provider: 'bancontact', configured: true, updatedAt: '2026-09-01T10:00:00Z' },
  { provider: 'sumup', configured: false, updatedAt: null },
]

export const mockIdentityProvider = {
  issuerUrl: '',
  clientId: '',
  hasClientSecret: false,
  connectionName: '',
  updatedAt: null as string | null,
}

export const mockWhoami = {
  name: 'Bert Carels',
  email: 'bert@kaboutersoft.be',
  sub: 'google-oauth2|000000000000000000000',
}
