import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { importCatalog, type ImportResult } from '../lib/catalog-api'
import { importErrorText, nameFromFileName, previewSections, type ImportRow } from '../lib/menu-sheet'

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
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [notices, setNotices] = useState<string[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
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
      setNotices(parsed.ignoredHeaders.length > 0 ? [`Genegeerde kolommen: ${parsed.ignoredHeaders.join(', ')}`] : [])
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
    setNotices([])
    if (picked && target.kind === 'new' && !name.trim()) setName(nameFromFileName(picked.name))
  }

  const sections = preview?.ok ? previewSections(preview.summary) : []
  const canPreview = !!file && (target.kind === 'replace' || !!name.trim()) && !busy

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target.kind === 'replace' ? `Importeren in ${target.catalogName}` : 'Menukaart importeren'}</DialogTitle>
          <DialogDescription>
            {target.kind === 'replace'
              ? 'Het bestand vervangt de groepen, de volgorde en de prijzen van deze menukaart. Producten worden nooit verwijderd — ze kunnen op andere menukaarten staan — en een lege Categorie, BTW of Code laat een bestaand product ongewijzigd.'
              : 'Maakt een nieuwe menukaart uit het bestand. Bestaande producten worden herkend op code of naam en hergebruikt.'}
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="menu-file">Bestand (.xlsx of .csv)</Label>
              <Input id="menu-file" type="file" accept=".xlsx,.csv" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
            </div>
            {target.kind === 'new' && (
              <div className="grid gap-2">
                <Label htmlFor="menu-name">Naam van de nieuwe menukaart</Label>
                <Input id="menu-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {notices.map((notice) => (
          <p key={notice} className="text-sm text-muted-foreground">
            {notice}
          </p>
        ))}

        {fileErrors.length > 0 && (
          <div className="grid gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" data-testid="import-errors">
            {fileErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        {preview && !preview.ok && (
          <div className="grid gap-2" data-testid="import-errors">
            <p className="text-sm font-medium">Het bestand bevat fouten — er is niets gewijzigd. Pas het bestand aan en probeer opnieuw.</p>
            <ul className="grid gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {preview.errors.map((e, i) => (
                <li key={i}>{importErrorText(e)}</li>
              ))}
            </ul>
          </div>
        )}

        {preview?.ok && (
          <div className="grid gap-3 text-sm" data-testid="import-preview">
            <p>
              {preview.summary.rows} rijen in {preview.summary.groups} groep{preview.summary.groups === 1 ? '' : 'en'}.
              {sections.length === 0 && ' Geen wijzigingen.'}
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
            {preview.summary.unchanged > 0 && <p className="text-muted-foreground">{preview.summary.unchanged} lijnen ongewijzigd.</p>}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {preview ? (
            <Button variant="outline" disabled={busy} onClick={() => chooseFile(null)}>
              Ander bestand
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Annuleren
            </Button>
          )}
          {preview ? (
            <Button disabled={busy || !preview.ok} onClick={apply}>
              Toepassen
            </Button>
          ) : (
            <Button disabled={!canPreview} onClick={showPreview}>
              {busy ? 'Bestand lezen…' : 'Voorbeeld bekijken'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
