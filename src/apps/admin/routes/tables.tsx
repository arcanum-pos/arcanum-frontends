import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Plus, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMessages, type Messages } from '@/shared/i18n'
import { createTable, listTablesAdmin, newTableQr, updateTable, type TableRecord } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'

// Tafels (DOMAIN_MODEL.md "Tables and waiters", release C): the
// organisation's tables (T1), optionally in a zone, each with its QR code —
// a waiter scanning it opens the table on the waiter screen, a guest orders
// on the table's tab (T3). Admins make them; the QR codes print on one page.

const TEXTS: Messages<{
  title: string
  intro: string
  add: string
  name: string
  zone: string
  zoneHint: string
  save: string
  cancel: string
  columns: { name: string; zone: string; state: string }
  states: Record<'free' | 'occupied' | 'clearing', string>
  archived: string
  none: string
  rename: string
  showQr: string
  newQr: string
  newQrConfirm: string
  archive: string
  restore: string
  print: string
  printTitle: string
  table: (name: string) => string
  waiterLink: string
}> = {
  nl: {
    title: 'Tafels',
    intro: 'De tafels van je zaak, eventueel per zone. Elke tafel heeft een QR-code: de bediening scant ze om de tafel te openen, gasten bestellen ermee bij op de rekening van hun tafel. De bediening werkt op /bediening.',
    add: 'Tafel toevoegen',
    name: 'Naam of nummer',
    zone: 'Zone (optioneel)',
    zoneHint: 'bv. Zaal, Terras',
    save: 'Opslaan',
    cancel: 'Annuleren',
    columns: { name: 'Tafel', zone: 'Zone', state: 'Nu' },
    states: { free: 'Vrij', occupied: 'Bezet', clearing: 'Af te ruimen' },
    archived: 'Gearchiveerd',
    none: 'Nog geen tafels.',
    rename: 'Naam en zone wijzigen',
    showQr: 'QR-code tonen',
    newQr: 'Nieuwe QR-code',
    newQrConfirm: 'De oude QR-code van deze tafel werkt dan niet meer. Doorgaan?',
    archive: 'Archiveren',
    restore: 'Terugzetten',
    print: 'QR-codes afdrukken',
    printTitle: 'QR-codes',
    table: (name) => `Tafel ${name}`,
    waiterLink: 'Bediening openen',
  },
  fr: {
    title: 'Tables',
    intro: 'Les tables de votre établissement, éventuellement par zone. Chaque table a un code QR : le service le scanne pour ouvrir la table, les clients l’utilisent pour commander sur l’addition de leur table. Le service travaille sur /bediening.',
    add: 'Ajouter une table',
    name: 'Nom ou numéro',
    zone: 'Zone (facultatif)',
    zoneHint: 'p. ex. Salle, Terrasse',
    save: 'Enregistrer',
    cancel: 'Annuler',
    columns: { name: 'Table', zone: 'Zone', state: 'Maintenant' },
    states: { free: 'Libre', occupied: 'Occupée', clearing: 'À débarrasser' },
    archived: 'Archivée',
    none: 'Pas encore de tables.',
    rename: 'Modifier le nom et la zone',
    showQr: 'Afficher le code QR',
    newQr: 'Nouveau code QR',
    newQrConfirm: 'L’ancien code QR de cette table ne fonctionnera plus. Continuer ?',
    archive: 'Archiver',
    restore: 'Rétablir',
    print: 'Imprimer les codes QR',
    printTitle: 'Codes QR',
    table: (name) => `Table ${name}`,
    waiterLink: 'Ouvrir le service',
  },
  en: {
    title: 'Tables',
    intro: 'Your venue’s tables, optionally per zone. Each table has a QR code: waiters scan it to open the table, guests use it to order on their table’s tab. Waiters work at /bediening.',
    add: 'Add table',
    name: 'Name or number',
    zone: 'Zone (optional)',
    zoneHint: 'e.g. Hall, Terrace',
    save: 'Save',
    cancel: 'Cancel',
    columns: { name: 'Table', zone: 'Zone', state: 'Now' },
    states: { free: 'Free', occupied: 'Occupied', clearing: 'To clear' },
    archived: 'Archived',
    none: 'No tables yet.',
    rename: 'Change name and zone',
    showQr: 'Show QR code',
    newQr: 'New QR code',
    newQrConfirm: 'This table’s old QR code will stop working. Continue?',
    archive: 'Archive',
    restore: 'Restore',
    print: 'Print QR codes',
    printTitle: 'QR codes',
    table: (name) => `Table ${name}`,
    waiterLink: 'Open the waiter screen',
  },
}

const qrUrl = (token: string | null) => (token ? `${window.location.origin}/tafel/${token}` : '')

export default function TablesPage() {
  const t = useMessages(TEXTS)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data, reload } = useAsync(() => (orgId ? listTablesAdmin(orgId) : Promise.resolve([])), [orgId])
  const [editing, setEditing] = useState<TableRecord | 'new' | null>(null)
  const [qrFor, setQrFor] = useState<TableRecord | null>(null)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const active = (data ?? []).filter((x) => !x.archived)

  if (printing)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => window.print()}>
            <Printer /> {t.print}
          </Button>
          <Button variant="outline" onClick={() => setPrinting(false)}>
            {t.cancel}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 print:hidden" data-testid="qr-sheet">
          {active.map((x) => (
            <div key={x.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border p-4">
              <QRCodeSVG value={qrUrl(x.qrToken)} size={160} marginSize={0} />
              <span className="text-xl font-bold">{t.table(x.name)}</span>
              {x.zone && <span className="text-sm text-muted-foreground">{x.zone}</span>}
            </div>
          ))}
        </div>
        {/* What goes on paper: only the cards (globals.css .print-sheet hides
            the console around them), in millimetres for A4 — 3 across, 4 down
            a page, a card never split over two pages. */}
        {createPortal(
          <div className="print-sheet hidden print:block" data-testid="qr-print">
            <div className="grid grid-cols-3 gap-[6mm]">
              {active.map((x) => (
                <div key={x.id} className="flex h-[62mm] break-inside-avoid flex-col items-center justify-center gap-[2mm] rounded-[3mm] border border-black p-[4mm] text-black">
                  <QRCodeSVG value={qrUrl(x.qrToken)} size={160} marginSize={0} style={{ width: '42mm', height: '42mm' }} />
                  <span className="text-[14pt] leading-tight font-bold">{t.table(x.name)}</span>
                  {x.zone && <span className="text-[9pt] leading-tight">{x.zone}</span>}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/bediening" target="_blank" rel="noopener">
              {t.waiterLink}
            </a>
          </Button>
          <Button variant="outline" disabled={active.length === 0} onClick={() => setPrinting(true)}>
            <Printer /> {t.print}
          </Button>
          <Button onClick={() => setEditing('new')} disabled={!orgId}>
            <Plus /> {t.add}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.name}</TableHead>
            <TableHead>{t.columns.zone}</TableHead>
            <TableHead>{t.columns.state}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                {t.none}
              </TableCell>
            </TableRow>
          )}
          {orgId &&
            (data ?? []).map((x) => (
              <TableRow key={x.id} data-testid="table-row">
                <TableCell className="font-medium">{t.table(x.name)}</TableCell>
                <TableCell>{x.zone ?? ''}</TableCell>
                <TableCell>{x.archived ? <Badge variant="outline">{t.archived}</Badge> : t.states[x.state]}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={t.table(x.name)}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(x)}>{t.rename}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setQrFor(x)}>{t.showQr}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => confirm(t.newQrConfirm) && act(() => newTableQr(orgId, x.id))}>{t.newQr}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => act(() => updateTable(orgId, x.id, { archived: !x.archived }))}>{x.archived ? t.restore : t.archive}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {orgId && editing && (
        <TableDialog
          t={t}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (name, zone) => {
            if (editing === 'new') await createTable(orgId, name, zone)
            else await updateTable(orgId, editing.id, { name, zone })
            reload()
          }}
        />
      )}
      {qrFor && (
        <Dialog open onOpenChange={(open) => !open && setQrFor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.table(qrFor.name)}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-2" data-testid="table-qr">
              <QRCodeSVG value={qrUrl(qrFor.qrToken)} size={220} marginSize={0} />
              <code className="text-xs break-all text-muted-foreground">{qrUrl(qrFor.qrToken)}</code>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function TableDialog({ t, initial, onClose, onSave }: { t: (typeof TEXTS)['nl']; initial: TableRecord | null; onClose: () => void; onSave: (name: string, zone: string | null) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [zone, setZone] = useState(initial?.zone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(name.trim(), zone.trim() || null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t.rename : t.add}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="table-name">{t.name}</Label>
            <Input id="table-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="table-zone">{t.zone}</Label>
            <Input id="table-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder={t.zoneHint} maxLength={30} autoComplete="off" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

