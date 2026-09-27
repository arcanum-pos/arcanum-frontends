import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_ERROR_MESSAGES } from '@/shared/api-errors'
import { useMessages } from '@/shared/i18n'
import { importCatalog, type ImportResult } from '../lib/catalog-api'
import { importErrorText, nameFromFileName, previewSections, sheetProblemText, type ImportRow, type SheetProblem } from '../lib/menu-sheet'
import { ADMIN_CATALOG_MESSAGES } from '../messages/catalog'

export type ImportTarget = { kind: 'replace'; catalogId: string; catalogName: string } | { kind: 'new' }

// Import a menukaart from an .xlsx/.csv file: pick a file → the browser
// reads it (raw cells) → the backend's dry run → preview of every change
// (or the errors per row) → Toepassen. Nothing is written before
// Toepassen, and the apply itself is all-or-nothing on the server.
export function MenuImportDialog({
  orgId,
  target,
  onClose,
  onApplied,
}: {
  orgId: string
  target: ImportTarget
  onClose: () => void
  onApplied: (catalog: { id: string; name: string }) => void
}) {
  const m = useMessages(ADMIN_CATALOG_MESSAGES)
  const apiErrors = useMessages(API_ERROR_MESSAGES)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  // Kept as found, worded at render time (the language can change live).
  const [ignoredHeaders, setIgnoredHeaders] = useState<string[]>([])
  const [fileErrors, setFileErrors] = useState<SheetProblem[]>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = (dryRun: boolean, importRows: ImportRow[]) =>
    importCatalog(orgId, target.kind === 'replace' ? { catalogId: target.catalogId, dryRun, rows: importRows } : { name: name.trim(), dryRun, rows: importRows })

  async function showPreview() {
    if (!file) return
    setBusy(true)
    setError(null)
    setFileErrors([])
    setPreview(null)
    try {
      const { readMenuFile } = await import('../lib/menu-files')
      const parsed = await readMenuFile(file)
      setIgnoredHeaders(parsed.ignoredHeaders)
      if (parsed.errors.length > 0) {
        setFileErrors(parsed.errors)
        return
      }
      setRows(parsed.rows)
      setPreview(await request(true, parsed.rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!rows) return
    setBusy(true)
    setError(null)
    try {
      const result = await request(false, rows)
      // Something changed since the preview (e.g. another admin): show
      // the new errors instead of applying.
      if (!result.ok) {
        setPreview(result)
        return
      }
      onApplied(result.catalog ?? (target.kind === 'replace' ? { id: target.catalogId, name: target.catalogName } : { id: '', name: name.trim() }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function chooseFile(picked: File | null) {
    setFile(picked)
    setPreview(null)
    setRows(null)
    setFileErrors([])
    setIgnoredHeaders([])
    if (picked && target.kind === 'new' && !name.trim()) setName(nameFromFileName(picked.name))
  }

  const summary = preview?.ok ? preview.summary : null
  const sections = summary ? previewSections(m, summary) : []
  const fileErrorTexts = fileErrors.map((problem) => sheetProblemText(m, problem))
  const canPreview = !!file && (target.kind === 'replace' || !!name.trim()) && !busy

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target.kind === 'replace' ? m.importInto(target.catalogName) : m.importCatalog}</DialogTitle>
          <DialogDescription>
            {target.kind === 'replace' ? m.importReplaceDescription : m.importNewDescription}
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="menu-file">{m.importFile}</Label>
              <Input id="menu-file" type="file" accept=".xlsx,.csv" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
            </div>
            {target.kind === 'new' && (
              <div className="grid gap-2">
                <Label htmlFor="menu-name">{m.importName}</Label>
                <Input id="menu-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {ignoredHeaders.length > 0 && <p className="text-sm text-muted-foreground">{m.ignoredColumns(ignoredHeaders.join(', '))}</p>}

        {fileErrorTexts.length > 0 && (
          <div className="grid gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" data-testid="import-errors">
            {fileErrorTexts.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        {preview && !preview.ok && (
          <div className="grid gap-2" data-testid="import-errors">
            <p className="text-sm font-medium">{m.importHasErrors}</p>
            <ul className="grid gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {preview.errors.map((e, i) => (
                <li key={i}>{importErrorText(m, apiErrors, e)}</li>
              ))}
            </ul>
          </div>
        )}

        {summary && (
          <div className="grid gap-3 text-sm" data-testid="import-preview">
            <p>
              {m.previewCounts(summary.rows, summary.groups)}
              {sections.length === 0 && m.noChanges}
            </p>
            {sections.map((section) => (
              <div key={section.title} className="grid gap-1">
                <p className="font-medium">
                  {section.title} ({section.items.length})
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {summary.unchanged > 0 && <p className="text-muted-foreground">{m.unchangedLines(summary.unchanged)}</p>}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {preview ? (
            <Button variant="outline" disabled={busy} onClick={() => chooseFile(null)}>
              {m.otherFile}
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              {m.cancel}
            </Button>
          )}
          {preview ? (
            <Button disabled={busy || !preview.ok} onClick={apply}>
              {m.apply}
            </Button>
          ) : (
            <Button disabled={!canPreview} onClick={showPreview}>
              {busy ? m.readingFile : m.showPreview}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
