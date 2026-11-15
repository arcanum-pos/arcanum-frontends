import { useMessages } from '@/shared/i18n'
import { ADMIN_BACKUP_MESSAGES } from '../messages/backup'

// On a cloud installation, an org that is a local installation's backup
// (OFFLINE.md) is read-only: say so on every page. The layout disables the
// controls of pages that change it; a change tried anyway is refused by
// the backend (org_read_only).
export function BackupBanner({ replica }: { replica: boolean }) {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  if (!replica) return null
  return (
    <div role="status" data-testid="backup-banner" className="mb-6 rounded-md border border-sky-500/50 bg-sky-500/10 p-3 text-sm">
      <p className="font-medium">{m.bannerTitle}</p>
      <p className="text-muted-foreground">{m.bannerText}</p>
    </div>
  )
}
