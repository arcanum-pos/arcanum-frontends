import { apiErrorMessage } from '@/shared/api-errors'

export interface Membership {
  orgId: string
  orgName: string
  role: 'admin' | 'cashier'
  // The org's default language (organizations.locale).
  orgLocale?: string
}

export async function listMyMemberships(): Promise<Membership[]> {
  const res = await fetch('/api/organizations/memberships', { headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(data, `status ${res.status}`))
  return data as Membership[]
}
