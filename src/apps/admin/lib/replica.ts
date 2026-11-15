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

// Pages that still work on a backup: they only read, or change what isn't
// synced (who has access, the own profile), or are the way out (promote).
const OPEN_ON_REPLICA = ['/dashboard', '/reports', '/users', '/settings/profile', '/settings/data', '/settings/backup']

export function editableOnReplica(pathname: string): boolean {
  const path = pathname.replace(/^\/console(?=\/|$)/, '') || '/'
  return OPEN_ON_REPLICA.some((p) => path === p || path.startsWith(`${p}/`))
}
