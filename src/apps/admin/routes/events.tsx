import { useState } from 'react'
import { TicketCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createEvent, deleteEvent, listEvents, type Event } from '../lib/api'
import { listCatalogs } from '../lib/catalog-api'
import { EventSettingsDialog } from '../components/event-settings-dialog'
import { RowActions } from '../components/row-actions'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { formatEventDays } from '../lib/format'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

// Events: name + days (what tabs and reports are tagged with), and per
// event its menu, self-ordering and order numbers (EventSettingsDialog).
export default function EventsPage() {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const intlLocale = INTL_LOCALES[useLocale().locale]
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: events, loading, error, reload } = useAsync(
    () => (orgId ? listEvents(orgId) : Promise.resolve([])),
    [orgId]
  )

  const { data: catalogs } = useAsync(() => (orgId ? listCatalogs(orgId) : Promise.resolve([])), [orgId])
  const [settingsFor, setSettingsFor] = useState<Event | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Only an event nothing was sold for — the backend says so otherwise (event_in_use).
  async function handleDelete(event: Event) {
    if (!orgId || !window.confirm(m.events.confirmDelete(event.name))) return
    setDeleting(event.id)
    setDeleteError(null)
    try {
      await deleteEvent(orgId, event.id)
      reload()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreate() {
    if (!orgId) return
    if (!name.trim() || !date) return
    setCreating(true)
    setCreateError(null)
    try {
      await createEvent(orgId, { name: name.trim(), date, endDate: endDate || null })
      setName('')
      setDate('')
      setEndDate('')
      setCreateOpen(false)
      reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.events.title}</h1>
          <p className="text-muted-foreground">{m.events.subtitle(currentOrg?.name ?? m.thisOrg)}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!orgId}>{m.events.create}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.events.create}</DialogTitle>
              <DialogDescription>{m.events.createHint}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-name">{m.name}</Label>
                <Input id="event-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder={m.events.namePlaceholder} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="event-date">{m.events.firstDay}</Label>
                  <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="grid content-start gap-2">
                  <Label htmlFor="event-end-date">{m.events.lastDay}</Label>
                  <Input id="event-end-date" type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{m.events.lastDayHint}</p>
                </div>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? m.busy : m.events.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{m.events.loadError(error)}</p>}
      {deleteError && (
        <p className="text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.name}</TableHead>
            <TableHead>{m.events.period}</TableHead>
            <TableHead className="hidden sm:table-cell">{m.events.modes}</TableHead>
            <TableHead>{m.events.selfOrder}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 2 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && events?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 py-6">
                  <TicketCheck className="size-6" />
                  {m.events.empty}
                </div>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            events?.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>{formatEventDays(event, intlLocale)}</TableCell>
                <TableCell className="hidden sm:table-cell">{event.modes?.length ? event.modes.map((mode) => mode.name).join(', ') : '-'}</TableCell>
                <TableCell>{event.selfOrder?.enabled ? m.events.on : m.events.off}</TableCell>
                <TableCell className="text-right">
                  <RowActions
                    name={event.name}
                    disabled={deleting === event.id}
                    actions={[
                      { label: m.events.settings, onSelect: () => setSettingsFor(event) },
                      { label: m.remove, destructive: true, onSelect: () => handleDelete(event) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {orgId && <EventSettingsDialog orgId={orgId} event={settingsFor} catalogs={catalogs ?? []} onClose={() => setSettingsFor(null)} onChanged={() => reload()} />}
    </div>
  )
}
