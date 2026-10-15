import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatEuro } from '@/shared/format'
import { INTL_LOCALES, useLocale, useMessages, type Messages } from '@/shared/i18n'
import { PromptDialog } from '../components/prompt-dialog'
import { createRegister, listRegistersAdmin, listShifts, setBlindCount, updateRegister, type RegisterRecord } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'

// Kassalades (DOMAIN_MODEL.md "Registers, shifts and kasopmaak", release
// B2): the cash drawers a kassa picks in its Instellingen — then it opens
// and closes them (Kassa openen, kasopmaak). The latest shifts with their
// difference; blind count as a setting. Admins make and rename them.

const TEXTS: Messages<{
  title: string
  intro: string
  add: string
  name: string
  blind: string
  blindHint: string
  columns: { name: string; state: string }
  open: string
  closed: string
  archived: string
  none: string
  rename: string
  archive: string
  restore: string
  save: string
  shifts: string
  shiftColumns: { shift: string; register: string; opened: string; closed: string; expected: string; counted: string; difference: string }
  noShifts: string
  stillOpen: string
}> = {
  nl: {
    title: 'Kassalades',
    intro: 'Een kassalade is de geldlade van een kassa. Een kassa kiest de hare in Instellingen; dan opent ze de lade met het wisselgeld en sluit ze af met de kasopmaak. Meerdere toestellen kunnen één lade delen. Een kassa zonder lade werkt zoals vroeger.',
    add: 'Kassalade toevoegen',
    name: 'Naam',
    blind: 'Blind tellen',
    blindHint: 'Bij de kasopmaak telt men eerst; het verwachte bedrag verschijnt pas daarna.',
    columns: { name: 'Naam', state: 'Nu' },
    open: 'Open',
    closed: 'Dicht',
    archived: 'Gearchiveerd',
    none: 'Nog geen kassalades.',
    rename: 'Naam wijzigen',
    archive: 'Archiveren',
    restore: 'Terugzetten',
    save: 'Opslaan',
    shifts: 'Laatste shifts',
    shiftColumns: { shift: 'Shift', register: 'Lade', opened: 'Geopend', closed: 'Gesloten', expected: 'Verwacht', counted: 'Geteld', difference: 'Verschil' },
    noShifts: 'Nog geen shifts.',
    stillOpen: 'nog open',
  },
  fr: {
    title: 'Tiroirs-caisse',
    intro: 'Un tiroir-caisse est le tiroir à argent d’une caisse. Une caisse choisit le sien dans ses Réglages ; elle l’ouvre alors avec le fond de caisse et le clôture. Plusieurs appareils peuvent partager un tiroir. Une caisse sans tiroir fonctionne comme avant.',
    add: 'Ajouter un tiroir',
    name: 'Nom',
    blind: 'Comptage à l’aveugle',
    blindHint: 'À la clôture, on compte d’abord ; le montant attendu n’apparaît qu’ensuite.',
    columns: { name: 'Nom', state: 'Maintenant' },
    open: 'Ouvert',
    closed: 'Fermé',
    archived: 'Archivé',
    none: 'Pas encore de tiroir.',
    rename: 'Renommer',
    archive: 'Archiver',
    restore: 'Rétablir',
    save: 'Enregistrer',
    shifts: 'Derniers services',
    shiftColumns: { shift: 'Service', register: 'Tiroir', opened: 'Ouvert', closed: 'Fermé', expected: 'Attendu', counted: 'Compté', difference: 'Écart' },
    noShifts: 'Pas encore de service.',
    stillOpen: 'encore ouvert',
  },
  en: {
    title: 'Cash drawers',
    intro: 'A cash drawer is a till’s money drawer. A till picks its own in Settings; it then opens the drawer with the float and closes it with the cash-up. Several devices can share one drawer. A till without one works as before.',
    add: 'Add cash drawer',
    name: 'Name',
    blind: 'Blind count',
    blindHint: 'At the cash-up, people count first; the expected amount only shows after.',
    columns: { name: 'Name', state: 'Now' },
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived',
    none: 'No cash drawers yet.',
    rename: 'Rename',
    archive: 'Archive',
    restore: 'Restore',
    save: 'Save',
    shifts: 'Latest shifts',
    shiftColumns: { shift: 'Shift', register: 'Drawer', opened: 'Opened', closed: 'Closed', expected: 'Expected', counted: 'Counted', difference: 'Difference' },
    noShifts: 'No shifts yet.',
    stillOpen: 'still open',
  },
}

export default function RegistersPage() {
  const t = useMessages(TEXTS)
  const { locale } = useLocale()
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data, reload } = useAsync(() => (orgId ? listRegistersAdmin(orgId) : Promise.resolve(null)), [orgId])
  const { data: shifts } = useAsync(() => (orgId ? listShifts(orgId) : Promise.resolve([])), [orgId])
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<RegisterRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(INTL_LOCALES[locale], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!orgId}>
          <Plus /> {t.add}
        </Button>
      </div>
      {data && orgId && (
        <label className="flex max-w-2xl items-start gap-3 rounded-lg border p-3">
          <Switch checked={data.blindCount} onCheckedChange={(v) => act(() => setBlindCount(orgId, v))} aria-label={t.blind} />
          <span>
            <span className="block text-sm font-medium">{t.blind}</span>
            <span className="block text-xs text-muted-foreground">{t.blindHint}</span>
          </span>
        </label>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.name}</TableHead>
            <TableHead>{t.columns.state}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data && data.registers.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                {t.none}
              </TableCell>
            </TableRow>
          )}
          {orgId &&
            data?.registers.map((r) => (
              <TableRow key={r.id} data-testid="register-row">
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.archived ? <Badge variant="outline">{t.archived}</Badge> : r.open ? <Badge>{t.open}</Badge> : <span className="text-muted-foreground">{t.closed}</span>}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={r.name}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRenaming(r)}>{t.rename}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => act(() => updateRegister(orgId, r.id, { archived: !r.archived }))}>{r.archived ? t.restore : t.archive}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <h2 className="mt-4 text-lg font-semibold tracking-tight">{t.shifts}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.shiftColumns.shift}</TableHead>
            <TableHead>{t.shiftColumns.register}</TableHead>
            <TableHead>{t.shiftColumns.opened}</TableHead>
            <TableHead>{t.shiftColumns.closed}</TableHead>
            <TableHead className="text-right">{t.shiftColumns.expected}</TableHead>
            <TableHead className="text-right">{t.shiftColumns.counted}</TableHead>
            <TableHead className="text-right">{t.shiftColumns.difference}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(shifts ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                {t.noShifts}
              </TableCell>
            </TableRow>
          )}
          {(shifts ?? []).map((s) => (
            <TableRow key={s.id} data-testid="shift-row">
              <TableCell>#{s.number}</TableCell>
              <TableCell>{s.registerName}</TableCell>
              <TableCell>
                {when(s.openedAt)} {s.openedBy && <span className="text-muted-foreground">· {s.openedBy}</span>}
              </TableCell>
              <TableCell>{s.status === 'open' ? <Badge>{t.stillOpen}</Badge> : when(s.closedAt)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{s.expectedCents !== null ? formatEuro(s.expectedCents) : ''}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{s.countedCents !== null ? formatEuro(s.countedCents) : ''}</TableCell>
              <TableCell className={`text-right font-mono tabular-nums ${(s.differenceCents ?? 0) < 0 ? 'text-destructive' : ''}`} title={s.note ?? undefined}>
                {s.differenceCents !== null ? formatEuro(s.differenceCents) : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {orgId && adding && (
        <PromptDialog
          title={t.add}
          label={t.name}
          confirmLabel={t.save}
          onConfirm={async (name) => {
            await createRegister(orgId, name)
            reload()
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {orgId && renaming && (
        <PromptDialog
          key={renaming.id}
          title={t.rename}
          label={t.name}
          initialValue={renaming.name}
          confirmLabel={t.save}
          onConfirm={async (name) => {
            await updateRegister(orgId, renaming.id, { name })
            reload()
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  )
}
