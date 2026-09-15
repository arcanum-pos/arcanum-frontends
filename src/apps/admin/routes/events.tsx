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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// First step only: name + date. Doesn't drive kassa menus/catalogues yet
// (that needs the kassa itself to know which event is active — later work)
// — this just lets an org define events at all, and tag transactions/
// reports with one (see routes/reports.tsx).
export default function EventsPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Events van {currentOrg?.name ?? 'deze organisatie'}.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!orgId}>Nieuw event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw event</DialogTitle>
              <DialogDescription>Naam en datum — menu's/catalogi per event volgen later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-name">Naam</Label>
                <Input id="event-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="bv. Elewijtse Pijl 2027" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-date">Datum</Label>
                <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Bezig...' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">Kon events niet laden: {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Datum</TableHead>
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
                  Nog geen events aangemaakt.
                </div>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            events?.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>{formatDate(event.date)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
