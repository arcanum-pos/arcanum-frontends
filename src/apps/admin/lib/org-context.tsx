import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createOrganization, listMyOrganizations, type Organization } from './api'

const CURRENT_ORG_KEY = 'questo-admin-current-org'

interface OrgContextValue {
  orgs: Organization[]
  currentOrg: Organization | null
  loading: boolean
  error: string | null
  setCurrentOrgId: (id: string) => void
  addOrg: (name: string) => Promise<void>
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => localStorage.getItem(CURRENT_ORG_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMyOrganizations()
      .then((result) => {
        setOrgs(result)
        // Keep the persisted selection only if it's still a real, accessible
        // org; otherwise fall back to the first one.
        if (!result.some((o) => o.id === currentOrgId)) {
          setCurrentOrgIdState(result[0]?.id ?? null)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
    // Intentionally only on mount — switching orgs is a local selection change,
    // not a refetch of the whole list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setCurrentOrgId(id: string) {
    localStorage.setItem(CURRENT_ORG_KEY, id)
    setCurrentOrgIdState(id)
  }

  async function addOrg(name: string) {
    const org = await createOrganization(name)
    setOrgs((prev) => [...prev, org])
    setCurrentOrgId(org.id)
  }

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? orgs[0] ?? null

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, loading, error, setCurrentOrgId, addOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
