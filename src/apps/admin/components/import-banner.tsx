import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOrg } from '../lib/org-context'
import { abortImport } from '../lib/org-transfer'
import { OrgImportDialog } from './org-import-dialog'

// Shown for an org whose import never finished (e.g. the browser was
// closed halfway): resume with the same file, or throw the half-imported
// org away.
export function ImportBanner() {
  const { currentOrg, reloadOrgs } = useOrg()
  const [resumeOpen, setResumeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!currentOrg || currentOrg.importStatus !== 'importing') return null

  async function cancel() {
    if (!currentOrg || !window.confirm(`De onafgewerkte import van "${currentOrg.name}" en alles wat al geïmporteerd werd verwijderen?`)) return
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
        <p className="font-medium">Deze import is niet afgewerkt</p>
        <p className="text-muted-foreground">Hervat met hetzelfde exportbestand, of annuleer om deze organisatie weer te verwijderen.</p>
        {error && <p className="text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
          Annuleren
        </Button>
        <Button size="sm" onClick={() => setResumeOpen(true)} disabled={busy}>
          Hervatten
        </Button>
      </div>
      <OrgImportDialog open={resumeOpen} onOpenChange={setResumeOpen} resumeOrgId={currentOrg.id} resumeOrgName={currentOrg.name} />
    </div>
  )
}
