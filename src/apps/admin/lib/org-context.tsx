import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockOrgs, type MockOrg } from './mock-data'

// Placeholder: real version resolves from listMyOrganizations() + a
// selected-org id persisted per user, once this app talks to worker's
// actual /api/organizations API.
interface OrgContextValue {
  orgs: MockOrg[]
  currentOrg: MockOrg
  setCurrentOrgId: (id: string) => void
  addOrg: (org: MockOrg) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState(mockOrgs)
  const [currentOrgId, setCurrentOrgId] = useState(mockOrgs[0].id)

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? orgs[0]

  function addOrg(org: MockOrg) {
    setOrgs((prev) => [...prev, org])
    setCurrentOrgId(org.id)
  }

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, setCurrentOrgId, addOrg }}>{children}</OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
