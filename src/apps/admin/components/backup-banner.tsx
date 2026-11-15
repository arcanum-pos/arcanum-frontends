import { useEffect, useState } from 'react'
import { useMessages } from '@/shared/i18n'
import { getBackupStatus } from '../lib/backup-api'
import { useOrg } from '../lib/org-context'
import { ADMIN_BACKUP_MESSAGES } from '../messages/backup'

// On a cloud installation, an org that is a local installation's backup
// (OFFLINE.md) is read-only: say so on every page. A change tried anyway is
// refused by the backend (org_read_only).
export function BackupBanner() {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id
  // Which org it was asked for: switching orgs shows nothing until the new answer.
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

  const replica = !!orgId && replicaOf === orgId
  if (!replica) return null
  return (
    <div role="status" data-testid="backup-banner" className="mb-6 rounded-md border border-sky-500/50 bg-sky-500/10 p-3 text-sm">
      <p className="font-medium">{m.bannerTitle}</p>
      <p className="text-muted-foreground">{m.bannerText}</p>
    </div>
  )
}
