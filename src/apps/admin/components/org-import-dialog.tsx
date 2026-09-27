import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '../lib/org-context'
import { useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import {
  abortImport,
  fileProblemText,
  mismatchedTables,
  parseExportText,
  progressPercent,
  runImport,
  tableLabel,
  totalRows,
  type ExportFile,
  type FileProblem,
  type TableReport,
} from '../lib/org-transfer'

type Step =
  | { kind: 'pick'; problem?: FileProblem }
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
  const m = useMessages(ADMIN_ORG_MESSAGES)
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
      setStep({ kind: 'pick', problem: parsed.problem })
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
          <DialogTitle>{resumeOrgId ? m.orgImport.resumeTitle : m.orgImport.title}</DialogTitle>
          <DialogDescription>{resumeOrgId ? m.orgImport.resumeHint(resumeOrgName ?? m.thisOrg) : m.orgImport.hint}</DialogDescription>
        </DialogHeader>

        {step.kind === 'pick' && (
          <div className="grid gap-2">
            <Label htmlFor="org-import-file">{m.orgImport.file}</Label>
            <Input id="org-import-file" type="file" accept=".json,application/json" onChange={(e) => pickFile(e.target.files?.[0])} />
            {step.problem && (
              <p role="alert" className="text-sm text-destructive">
                {fileProblemText(m, step.problem)}
              </p>
            )}
          </div>
        )}

        {step.kind === 'summary' && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="org-import-name">{m.orgImport.orgName}</Label>
              <Input id="org-import-name" value={name} disabled={!!resumeOrgId} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <CountsTable file={step.file} />
            <p className="text-sm text-muted-foreground">
              {step.file.includesSecrets ? m.orgImport.withSecrets : m.orgImport.withoutSecrets} {m.orgImport.membersAsInvites}
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
              {m.orgImport.progress(step.done, step.total)}
            </p>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="grid gap-3">
            <p className="font-medium">{m.orgImport.done}</p>
            <ReportTable tables={step.tables} />
          </div>
        )}

        {step.kind === 'mismatch' && (
          <div className="grid gap-3">
            <p role="alert" className="text-sm text-destructive">
              {m.orgImport.mismatch}
            </p>
            <ul className="text-sm">
              {mismatchedTables(step.tables).map((t) => (
                <li key={t.table}>{m.orgImport.mismatchLine(tableLabel(m, t.table), t.imported, t.expected)}</li>
              ))}
            </ul>
          </div>
        )}

        {step.kind === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            {m.orgImport.failed(step.error)}
          </p>
        )}

        <DialogFooter>
          {step.kind === 'summary' && (
            <>
              <Button variant="outline" onClick={() => setStep({ kind: 'pick' })}>
                {m.orgImport.otherFile}
              </Button>
              <Button onClick={() => run(step.file)} disabled={!name.trim()}>
                {resumeOrgId ? m.orgImport.resume : m.orgImport.import}
              </Button>
            </>
          )}
          {step.kind === 'done' && (
            <Button onClick={() => goToOrg(step.orgId)} disabled={busy}>
              {m.orgImport.goToOrg}
            </Button>
          )}
          {(step.kind === 'mismatch' || step.kind === 'failed') && (
            <>
              {target.orgId && (
                <Button variant="destructive" onClick={abort} disabled={busy}>
                  {m.orgImport.abort}
                </Button>
              )}
              <Button onClick={() => run(step.file)} disabled={busy}>
                {m.orgImport.retry}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CountsTable({ file }: { file: ExportFile }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const rows = Object.entries(file.tables).filter(([, r]) => r.length > 0)
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
      <table className="w-full">
        <tbody>
          {rows.map(([table, r]) => (
            <tr key={table} className="border-b last:border-b-0">
              <td className="px-3 py-1.5">{tableLabel(m, table)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportTable({ tables }: { tables: TableReport }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const rows = Object.entries(tables).filter(([, r]) => r.expected > 0 || r.imported > 0)
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
      <table className="w-full">
        <tbody>
          {rows.map(([table, r]) => (
            <tr key={table} className="border-b last:border-b-0">
              <td className="px-3 py-1.5">{tableLabel(m, table)}</td>
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
