import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { showOrgIcons } from '@/shared/install'
import { createOrganization, getCapabilities, listMyOrganizations, type Capabilities, type Organization } from './api'

const CURRENT_ORG_KEY = 'arcanum-admin-current-org'
// The same, for arcanum-bff: it sends /console with this organisation's own
// console icon (Weergave → App-iconen) — Safari's Add to Dock reads only what
// was sent. Just the id, nothing secret.
const CONSOLE_ORG_COOKIE = 'arcanum-console-org'

function rememberConsoleOrg(id: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSOLE_ORG_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

interface OrgContextValue {
  orgs: Organization[]
  currentOrg: Organization | null
  loading: boolean
  error: string | null
  setCurrentOrgId: (id: string) => void
  addOrg: (name: string) => Promise<void>
  // Patches the current org's local copy in place — used after a save (e.g.
  // Preferences' org language) so the UI reflects it immediately without a
  // full org-list refetch.
  updateCurrentOrg: (patch: Partial<Organization>) => void
  // Refetches the org list (e.g. after an import created or removed one),
  // optionally selecting `selectId` afterwards.
  reloadOrgs: (selectId?: string) => Promise<void>
  // May the caller create / import an organization here (null = loading).
  capabilities: Capabilities | null
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => localStorage.getItem(CURRENT_ORG_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)

  useEffect(() => {
    getCapabilities().then(setCapabilities)
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
    // An own instance allows only its first org.
    getCapabilities().then(setCapabilities)
  }

  async function reloadOrgs(selectId?: string) {
    const result = await listMyOrganizations()
    setOrgs(result)
    getCapabilities().then(setCapabilities)
    const keep = selectId ?? currentOrgId
    const next = result.some((o) => o.id === keep) ? keep : (result[0]?.id ?? null)
    if (next) setCurrentOrgId(next)
    else setCurrentOrgIdState(null)
  }

  function updateCurrentOrg(patch: Partial<Organization>) {
    setOrgs((prev) => prev.map((o) => (o.id === currentOrgId ? { ...o, ...patch } : o)))
  }

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? orgs[0] ?? null

  // The organisation's own console icon: here (the tab, installing from
  // Chrome or Edge), and the next time the console is sent (the cookie).
  const shownOrgId = currentOrg?.id ?? null
  useEffect(() => {
    if (!shownOrgId) return
    rememberConsoleOrg(shownOrgId)
    showOrgIcons(shownOrgId, 'console', 'Console')
  }, [shownOrgId])

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, loading, error, setCurrentOrgId, addOrg, updateCurrentOrg, reloadOrgs, capabilities }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
