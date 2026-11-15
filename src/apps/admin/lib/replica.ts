import { useEffect, useState } from 'react'
import { getBackupStatus } from './backup-api'

// Whether an org is a local installation's backup here (OFFLINE.md): it is
// then read-only. False until known, and while switching orgs.
export function useIsReplica(orgId: string | undefined): boolean {
  const [replicaOf, setReplicaOf] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!orgId) return
    getBackupStatus(orgId)
      .then((s) => !cancelled && setReplicaOf(s.role === 'replica' ? orgId : null))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orgId])
  return !!orgId && replicaOf === orgId
}

// What a backup still shows (the rest is hidden, and disabled if opened
// by its address): its reports, the own profile, export and deleting, and
// the way out (promote). Not the dashboard: its onboarding and today's
// figures are for an org in use; a backup opens on its reports.
export const NAV_ON_REPLICA = ['reports', 'settings'] as const
export const REPLICA_HOME = '/reports'
export const SETTINGS_ON_REPLICA = ['profile', 'data', 'backup'] as const
const OPEN_ON_REPLICA = ['/reports', '/settings/profile', '/settings/data', '/settings/backup']

export function editableOnReplica(pathname: string): boolean {
  const path = pathname.replace(/^\/console(?=\/|$)/, '') || '/'
  return OPEN_ON_REPLICA.some((p) => path === p || path.startsWith(`${p}/`))
}
