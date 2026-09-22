export interface Membership {
  orgId: string
  orgName: string
  role: 'admin' | 'cashier'
}

export async function listMyMemberships(): Promise<Membership[]> {
  const res = await fetch('/api/organizations/memberships', { headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `status ${res.status}`)
  return data as Membership[]
}
