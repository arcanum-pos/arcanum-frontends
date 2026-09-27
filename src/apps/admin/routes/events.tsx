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
import { createEvent, listEvents } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

function formatDate(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// First step only: name + date. Doesn't drive kassa menus/catalogues yet
// (that needs the kassa itself to know which event is active — later work)
// — this just lets an org define events at all, and tag transactions/
// reports with one (see routes/reports.tsx).
export default function EventsPage() {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const intlLocale = INTL_LOCALES[useLocale().locale]
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: events, loading, error, reload } = useAsync(
    () => (orgId ? listEvents(orgId) : Promise.resolve([])),
    [orgId]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate() {
    if (!orgId) return
    if (!name.trim() || !date) return
    setCreating(true)
    setCreateError(null)
    try {
      await createEvent(orgId, { name: name.trim(), date })
      setName('')
      setDate('')
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
              <div className="grid gap-2">
                <Label htmlFor="event-date">{m.date}</Label>
                <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.name}</TableHead>
            <TableHead>{m.date}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 2 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={2}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && events?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
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
                <TableCell>{formatDate(event.date, intlLocale)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
