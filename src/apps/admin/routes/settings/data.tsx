import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { OrgImportDialog } from '../../components/org-import-dialog'
import { useOrg } from '../../lib/org-context'
import { downloadExport } from '../../lib/org-transfer'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

// Gegevens: export all of this org's data (to move it to its own
// installation, or keep a copy), and import an export as a new org.
export default function DataPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { currentOrg, capabilities } = useOrg()
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  async function handleExport() {
    if (!currentOrg) return
    setExporting(true)
    setExportError(null)
    try {
      await downloadExport(currentOrg.id, includeSecrets)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.settingsNav.data}</h2>
        <p className="text-sm text-muted-foreground">{m.dataSubtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.exportTitle}</CardTitle>
          <CardDescription>{m.exportDescription(currentOrg?.name ?? m.thisOrg)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{m.notInExport}</p>
            <ul className="mt-1 list-disc pl-5">
              <li>{m.notInExportKey}</li>
              <li>{m.notInExportDomain}</li>
              <li>{m.notInExportDevices}</li>
              <li>{m.notInExportMembers}</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
            />
            <span>{m.includeSecrets}</span>
          </label>
          {includeSecrets && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {m.secretsWarning}
            </p>
          )}

          <div>
            <Button onClick={handleExport} disabled={!currentOrg || exporting}>
              {exporting ? m.exporting : m.exportAll}
            </Button>
          </div>
          {exportError && <p className="text-sm text-destructive">{m.exportFailed(exportError)}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.importTitle}</CardTitle>
          <CardDescription>{m.importDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {capabilities && !capabilities.canImportOrganization ? (
            <p className="text-sm text-muted-foreground">{m.importNotHere}</p>
          ) : (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              {m.importFromFile}
            </Button>
          )}
        </CardContent>
      </Card>

      <OrgImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
