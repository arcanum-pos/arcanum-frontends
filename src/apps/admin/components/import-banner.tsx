import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/shared/i18n'
import { useOrg } from '../lib/org-context'
import { abortImport } from '../lib/org-transfer'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'
import { OrgImportDialog } from './org-import-dialog'

// Shown for an org whose import never finished (e.g. the browser was
// closed halfway): resume with the same file, or throw the half-imported
// org away.
export function ImportBanner() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { currentOrg, reloadOrgs } = useOrg()
  const [resumeOpen, setResumeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!currentOrg || currentOrg.importStatus !== 'importing') return null

  async function cancel() {
    if (!currentOrg || !window.confirm(m.abortImportConfirm(currentOrg.name))) return
    setBusy(true)
    setError(null)
    try {
      await abortImport(currentOrg.id)
      await reloadOrgs()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <div>
        <p className="font-medium">{m.importUnfinished}</p>
        <p className="text-muted-foreground">{m.importUnfinishedHint}</p>
        {error && <p className="text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
          {m.cancel}
        </Button>
        <Button size="sm" onClick={() => setResumeOpen(true)} disabled={busy}>
          {m.resume}
        </Button>
      </div>
      <OrgImportDialog open={resumeOpen} onOpenChange={setResumeOpen} resumeOrgId={currentOrg.id} resumeOrgName={currentOrg.name} />
    </div>
  )
}
