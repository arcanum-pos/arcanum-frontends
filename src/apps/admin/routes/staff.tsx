import { useState } from 'react'
import { KeyRound, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMessages, type Messages } from '@/shared/i18n'
import { PromptDialog } from '../components/prompt-dialog'
import { createStaff, listAllStaff, setStaffRequired, updateStaff, type StaffRecord } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { RowActions } from '../components/row-actions'
import { useOrg } from '../lib/org-context'

// Medewerkers (DOMAIN_MODEL.md "Staff on shared devices", release B1): the
// people who work on the shared kassas and station screens — a name and an
// optional PIN, no account needed. Admins only manage them (S6); whether a
// person must be chosen to sell is a setting here (S2).

const TEXTS: Messages<{
  title: string
  intro: string
  add: string
  name: string
  pin: string
  pinHint: string
  required: string
  requiredHint: string
  columns: { name: string; pin: string; status: string }
  withPin: string
  noPin: string
  active: string
  archived: string
  none: string
  rename: string
  setPin: string
  removePin: string
  archive: string
  restore: string
  save: string
  cancel: string
  pinTitle: (name: string) => string
  pinText: string
  loadError: (e: string) => string
  showArchived: string
}> = {
  nl: {
    title: 'Medewerkers',
    intro: 'Wie er op de gedeelde kassa’s en stationschermen werkt: een naam en eventueel een pincode - geen account nodig. Wat iemand doet, staat dan op zijn of haar naam.',
    add: 'Medewerker toevoegen',
    name: 'Naam',
    pin: 'Pincode (optioneel)',
    pinHint: '4 tot 6 cijfers. Zonder pincode kiest iemand zichzelf met een tik.',
    required: 'Medewerker kiezen verplicht',
    requiredHint: 'Een kassa verkoopt pas als er iemand gekozen is.',
    columns: { name: 'Naam', pin: 'Pincode', status: 'Status' },
    withPin: 'Met pincode',
    noPin: 'Geen',
    active: 'Actief',
    archived: 'Gearchiveerd',
    none: 'Nog geen medewerkers.',
    rename: 'Naam wijzigen',
    setPin: 'Pincode instellen',
    removePin: 'Pincode verwijderen',
    archive: 'Archiveren',
    restore: 'Terugzetten',
    save: 'Opslaan',
    cancel: 'Annuleren',
    pinTitle: (name) => `Pincode van ${name}`,
    pinText: 'Toestellen waarop deze medewerker gekozen was, vragen hem of haar opnieuw te kiezen.',
    loadError: (e) => `Kon de medewerkers niet laden: ${e}`,
    showArchived: 'Toon gearchiveerde',
  },
  fr: {
    title: 'Personnel',
    intro: 'Qui travaille sur les caisses et écrans de poste partagés : un nom et éventuellement un code PIN - sans compte. Ce que fait une personne est alors à son nom.',
    add: 'Ajouter',
    name: 'Nom',
    pin: 'Code PIN (facultatif)',
    pinHint: '4 à 6 chiffres. Sans code PIN, on se choisit d’un simple toucher.',
    required: 'Choix du personnel obligatoire',
    requiredHint: 'Une caisse ne vend que si quelqu’un est choisi.',
    columns: { name: 'Nom', pin: 'Code PIN', status: 'Statut' },
    withPin: 'Avec code PIN',
    noPin: 'Aucun',
    active: 'Actif',
    archived: 'Archivé',
    none: 'Pas encore de personnel.',
    rename: 'Renommer',
    setPin: 'Définir le code PIN',
    removePin: 'Supprimer le code PIN',
    archive: 'Archiver',
    restore: 'Rétablir',
    save: 'Enregistrer',
    cancel: 'Annuler',
    pinTitle: (name) => `Code PIN de ${name}`,
    pinText: 'Les appareils où cette personne était choisie demanderont de la choisir à nouveau.',
    loadError: (e) => `Impossible de charger le personnel : ${e}`,
    showArchived: 'Afficher les archivés',
  },
  en: {
    title: 'Staff',
    intro: 'Who works on the shared tills and station screens: a name and optionally a PIN - no account needed. What someone does is then recorded under their name.',
    add: 'Add staff member',
    name: 'Name',
    pin: 'PIN (optional)',
    pinHint: '4 to 6 digits. Without a PIN, someone picks themselves with a tap.',
    required: 'Choosing a staff member required',
    requiredHint: 'A till only sells once someone is chosen.',
    columns: { name: 'Name', pin: 'PIN', status: 'Status' },
    withPin: 'With PIN',
    noPin: 'None',
    active: 'Active',
    archived: 'Archived',
    none: 'No staff yet.',
    rename: 'Rename',
    setPin: 'Set PIN',
    removePin: 'Remove PIN',
    archive: 'Archive',
    restore: 'Restore',
    save: 'Save',
    cancel: 'Cancel',
    pinTitle: (name) => `${name}’s PIN`,
    pinText: 'Devices where this person was chosen will ask to choose them again.',
    loadError: (e) => `Couldn’t load the staff: ${e}`,
    showArchived: 'Show archived',
  },
}

export default function StaffPage() {
  const t = useMessages(TEXTS)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data, loading, error, reload } = useAsync(() => (orgId ? listAllStaff(orgId) : Promise.resolve(null)), [orgId])
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<StaffRecord | null>(null)
  const [pinFor, setPinFor] = useState<StaffRecord | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  async function act(fn: () => Promise<unknown>) {
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  const staff = (data?.staff ?? []).filter((s) => showArchived || !s.archived)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!orgId}>
          <UserPlus /> {t.add}
        </Button>
      </div>

      {data && orgId && (
        <label className="flex max-w-2xl items-start gap-3 rounded-lg border p-3" data-testid="staff-required">
          <Switch checked={data.required} onCheckedChange={(v) => act(() => setStaffRequired(orgId, v))} aria-label={t.required} />
          <span>
            <span className="block text-sm font-medium">{t.required}</span>
            <span className="block text-xs text-muted-foreground">{t.requiredHint}</span>
          </span>
        </label>
      )}

      {error && <p className="text-sm text-destructive">{t.loadError(error)}</p>}
      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.columns.name}</TableHead>
            <TableHead>{t.columns.pin}</TableHead>
            <TableHead>{t.columns.status}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            [0, 1].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && staff.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                {t.none}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            orgId &&
            staff.map((s) => (
              <TableRow key={s.id} data-testid="staff-row">
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.hasPin ? <Badge variant="secondary"><KeyRound className="size-3" /> {t.withPin}</Badge> : <span className="text-muted-foreground">{t.noPin}</span>}</TableCell>
                <TableCell>{s.archived ? <Badge variant="outline">{t.archived}</Badge> : t.active}</TableCell>
                <TableCell>
                  <RowActions
                    name={s.name}
                    actions={[
                      { label: t.rename, onSelect: () => setRenaming(s) },
                      { label: t.setPin, onSelect: () => setPinFor(s) },
                      s.hasPin && { label: t.removePin, onSelect: () => act(() => updateStaff(orgId, s.id, { pin: null })) },
                      { label: s.archived ? t.restore : t.archive, destructive: !s.archived, onSelect: () => act(() => updateStaff(orgId, s.id, { archived: !s.archived })) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {(data?.staff ?? []).some((s) => s.archived) && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label={t.showArchived} />
          {t.showArchived}
        </label>
      )}

      {orgId && adding && <AddDialog orgId={orgId} t={t} onClose={() => setAdding(false)} onAdded={reload} />}
      {orgId && renaming && (
        <PromptDialog
          key={renaming.id}
          title={t.rename}
          label={t.name}
          initialValue={renaming.name}
          confirmLabel={t.save}
          onConfirm={async (name) => {
            await updateStaff(orgId, renaming.id, { name })
            reload()
          }}
          onClose={() => setRenaming(null)}
        />
      )}
      {orgId && pinFor && (
        <PromptDialog
          key={`pin-${pinFor.id}`}
          title={t.pinTitle(pinFor.name)}
          description={t.pinText}
          label={t.pin}
          confirmLabel={t.save}
          onConfirm={async (pin) => {
            await updateStaff(orgId, pinFor.id, { pin })
            reload()
          }}
          onClose={() => setPinFor(null)}
        />
      )}
    </div>
  )
}

function AddDialog({ orgId, t, onClose, onAdded }: { orgId: string; t: (typeof TEXTS)['nl']; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    setBusy(true)
    setError(null)
    try {
      await createStaff(orgId, name.trim(), pin || undefined)
      onAdded()
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
          <DialogTitle>{t.add}</DialogTitle>
          <DialogDescription>{t.pinHint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="staff-name">{t.name}</Label>
            <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={60} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="staff-pin">{t.pin}</Label>
            <Input id="staff-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" />
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
