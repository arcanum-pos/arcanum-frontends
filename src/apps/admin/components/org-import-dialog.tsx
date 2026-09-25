import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '../lib/org-context'
import {
  abortImport,
  mismatchedTables,
  parseExportText,
  progressPercent,
  runImport,
  tableLabel,
  totalRows,
  type ExportFile,
  type TableReport,
} from '../lib/org-transfer'

type Step =
  | { kind: 'pick'; error?: string }
  | { kind: 'summary'; file: ExportFile }
  | { kind: 'running'; file: ExportFile; done: number; total: number }
  | { kind: 'done'; orgId: string; tables: TableReport }
  | { kind: 'mismatch'; file: ExportFile; orgId: string; tables: TableReport }
  | { kind: 'failed'; file: ExportFile; error: string }

// Import an export file as a NEW organization — or, with `resumeOrgId`,
// finish an import of that org that was interrupted (same file again; every
// chunk is re-sent, which is safe: the backend inserts nothing twice).
export function OrgImportDialog({
  open,
  onOpenChange,
  resumeOrgId,
  resumeOrgName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resumeOrgId?: string
  resumeOrgName?: string
}) {
  const { reloadOrgs } = useOrg()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // The org this import writes into once it exists, plus the order/size the
  // server gave — kept so a failure can be retried or aborted.
  const [target, setTarget] = useState<{ orgId?: string; tables?: string[]; maxChunkRows?: number }>({ orgId: resumeOrgId })

  function reset() {
    setStep({ kind: 'pick' })
    setName('')
    setTarget({ orgId: resumeOrgId })
  }

  function close(nextOpen: boolean) {
    if (step.kind === 'running') return // never leave mid-import by accident
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function pickFile(fileInput: File | undefined) {
    if (!fileInput) return
    const parsed = parseExportText(await fileInput.text())
    if (!parsed.ok) {
      setStep({ kind: 'pick', error: parsed.error })
      return
    }
    setName(resumeOrgName ?? parsed.file.organization.name)
    setStep({ kind: 'summary', file: parsed.file })
  }

  async function run(file: ExportFile) {
    setStep({ kind: 'running', file, done: 0, total: totalRows(file) })
    try {
      const result = await runImport({
        file,
        name: name.trim() || file.organization.name,
        ...target,
        onStarted: (orgId, tables, maxChunkRows) => setTarget({ orgId, tables, maxChunkRows }),
        onProgress: (done, total) => setStep({ kind: 'running', file, done, total }),
      })
      if (result.ok) setStep({ kind: 'done', orgId: result.orgId, tables: result.tables })
      else setStep({ kind: 'mismatch', file, orgId: result.orgId, tables: result.tables })
    } catch (err) {
      setStep({ kind: 'failed', file, error: err instanceof Error ? err.message : String(err) })
    }
  }

  async function goToOrg(orgId: string) {
    setBusy(true)
    try {
      await reloadOrgs(orgId)
      reset()
      onOpenChange(false)
      navigate({ to: '/dashboard' })
    } finally {
      setBusy(false)
    }
  }

  async function abort() {
    const orgId = target.orgId
    if (!orgId) return close(false)
    setBusy(true)
    try {
      await abortImport(orgId)
      await reloadOrgs()
      reset()
      onOpenChange(false)
    } catch (err) {
      setStep((s) => ('file' in s ? { kind: 'failed', file: s.file, error: err instanceof Error ? err.message : String(err) } : s))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" showCloseButton={step.kind !== 'running'}>
        <DialogHeader>
          <DialogTitle>{resumeOrgId ? 'Import hervatten' : 'Organisatie importeren'}</DialogTitle>
          <DialogDescription>
            {resumeOrgId
              ? `Kies hetzelfde exportbestand opnieuw om de import van "${resumeOrgName ?? 'deze organisatie'}" af te werken.`
              : 'Maakt een nieuwe organisatie aan met alle gegevens uit een Arcanum-exportbestand. Jij wordt er beheerder van.'}
          </DialogDescription>
        </DialogHeader>

        {step.kind === 'pick' && (
          <div className="grid gap-2">
            <Label htmlFor="org-import-file">Exportbestand (.json)</Label>
            <Input id="org-import-file" type="file" accept=".json,application/json" onChange={(e) => pickFile(e.target.files?.[0])} />
            {step.error && (
              <p role="alert" className="text-sm text-destructive">
                {step.error}
              </p>
            )}
          </div>
        )}

        {step.kind === 'summary' && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="org-import-name">Naam van de organisatie</Label>
              <Input id="org-import-name" value={name} disabled={!!resumeOrgId} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <CountsTable file={step.file} />
            <p className="text-sm text-muted-foreground">
              {step.file.includesSecrets
                ? 'Dit bestand bevat betaal- en mailinstellingen; die worden opnieuw versleuteld met de sleutel van de nieuwe organisatie.'
                : 'Dit bestand bevat geen betaal- of mailinstellingen — stel die na de import zelf opnieuw in.'}{' '}
              Leden komen terug als uitnodiging en worden actief bij hun eerste login.
            </p>
          </div>
        )}

        {step.kind === 'running' && (
          <div className="grid gap-2" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent(step.done, step.total)}
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent(step.done, step.total)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Bezig met importeren… {step.done} / {step.total} rijen
            </p>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="grid gap-3">
            <p className="font-medium">Import voltooid.</p>
            <ReportTable tables={step.tables} />
          </div>
        )}

        {step.kind === 'mismatch' && (
          <div className="grid gap-3">
            <p role="alert" className="text-sm text-destructive">
              Niet alle gegevens zijn aangekomen. Opnieuw proberen is veilig — niets wordt dubbel geïmporteerd.
            </p>
            <ul className="text-sm">
              {mismatchedTables(step.tables).map((m) => (
                <li key={m.table}>
                  {tableLabel(m.table)}: {m.imported} van {m.expected}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step.kind === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            De import is onderbroken: {step.error}
          </p>
        )}

        <DialogFooter>
          {step.kind === 'summary' && (
            <>
              <Button variant="outline" onClick={() => setStep({ kind: 'pick' })}>
                Ander bestand
              </Button>
              <Button onClick={() => run(step.file)} disabled={!name.trim()}>
                {resumeOrgId ? 'Hervatten' : 'Importeren'}
              </Button>
            </>
          )}
          {step.kind === 'done' && (
            <Button onClick={() => goToOrg(step.orgId)} disabled={busy}>
              Naar de nieuwe organisatie
            </Button>
          )}
          {(step.kind === 'mismatch' || step.kind === 'failed') && (
            <>
              {target.orgId && (
                <Button variant="destructive" onClick={abort} disabled={busy}>
                  Import annuleren
                </Button>
              )}
              <Button onClick={() => run(step.file)} disabled={busy}>
                Opnieuw proberen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CountsTable({ file }: { file: ExportFile }) {
  const rows = Object.entries(file.tables).filter(([, r]) => r.length > 0)
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
      <table className="w-full">
        <tbody>
          {rows.map(([table, r]) => (
            <tr key={table} className="border-b last:border-b-0">
              <td className="px-3 py-1.5">{tableLabel(table)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportTable({ tables }: { tables: TableReport }) {
  const rows = Object.entries(tables).filter(([, r]) => r.expected > 0 || r.imported > 0)
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
      <table className="w-full">
        <tbody>
          {rows.map(([table, r]) => (
            <tr key={table} className="border-b last:border-b-0">
              <td className="px-3 py-1.5">{tableLabel(table)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {r.imported} / {r.expected}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
