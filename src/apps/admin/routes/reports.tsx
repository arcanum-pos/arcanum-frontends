import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listEvents, listTransactions } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { formatEuro } from '../lib/format'

const METHOD_LABELS: Record<string, string> = { cash: 'Cash', sumup: 'SumUp', bancontact: 'Bancontact' }
const ALL_EVENTS = '__all__'

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Just the plain transaction list for now — this is meant to grow into a
// real reports section (see Dashboard for the same "reserved space" idea).
// Deliberately not porting webapp's transactions.astro's event-specific
// bits (bonnen/fietstocht/wandeltocht/fooi counts, tijdvak/slot filtering)
// — those are tied to one event's own product taxonomy, not something
// every org would have.
//
// Event filter is "first step" only: nothing tags a transaction with an
// event at creation time yet (see worker/src/transactions.ts's eventId
// comment), so filtering by event mostly shows "no transactions" until a
// kassa actually sends one — the selector/plumbing is here so that's a
// one-line change later, not another feature.
export default function ReportsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null

  const { data: events } = useAsync(() => (orgId ? listEvents(orgId) : Promise.resolve([])), [orgId])

  // '' = no explicit selection yet, ALL_EVENTS = "Alle events" chosen
  // explicitly. Auto-selects the single event once exactly one exists.
  const [selectedEvent, setSelectedEvent] = useState<string>('')

  useEffect(() => {
    if (!events) return
    if (selectedEvent) return
    if (events.length === 1) setSelectedEvent(events[0].id)
    else setSelectedEvent(ALL_EVENTS)
  }, [events, selectedEvent])

  const eventFilter = selectedEvent && selectedEvent !== ALL_EVENTS ? selectedEvent : undefined

  const { data: transactions, loading, error } = useAsync(
    () => (orgId && selectedEvent ? listTransactions(orgId, eventFilter) : Promise.resolve([])),
    [orgId, selectedEvent, eventFilter]
  )

  const sorted = [...(transactions ?? [])].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )
  const totalCents = sorted.reduce((sum, t) => sum + t.amountCents, 0)
  const cashCents = sorted.filter((t) => t.method === 'cash').reduce((sum, t) => sum + t.amountCents, 0)
  const sumupCents = sorted.filter((t) => t.method === 'sumup').reduce((sum, t) => sum + t.amountCents, 0)
  const bancontactCents = totalCents - cashCents - sumupCents

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rapporten</h1>
          <p className="text-muted-foreground">
            Transacties van {currentOrg?.name ?? 'deze organisatie'}. Meer rapportage volgt later.
          </p>
        </div>
        {events && events.length > 0 && (
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENTS}>Alle events</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} — {formatDate(event.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && <p className="text-sm text-destructive">Kon transacties niet laden: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totaal</CardDescription>
            <CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : formatEuro(totalCents)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? '' : `${sorted.length} geslaagde betaling${sorted.length === 1 ? '' : 'en'}`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bancontact</CardDescription>
            <CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : formatEuro(bancontactCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>SumUp</CardDescription>
            <CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : formatEuro(sumupCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cash</CardDescription>
            <CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : formatEuro(cashCents)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tijdstip</TableHead>
            <TableHead>Omschrijving</TableHead>
            <TableHead>Methode</TableHead>
            <TableHead>Toestel</TableHead>
            <TableHead>Gebruiker</TableHead>
            <TableHead className="text-right">Bedrag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nog geen transacties.
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            sorted.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatTime(tx.completedAt)}</TableCell>
                <TableCell>{tx.description || '—'}</TableCell>
                <TableCell>{methodLabel(tx.method)}</TableCell>
                <TableCell>{tx.deviceName || '—'}</TableCell>
                <TableCell>{tx.userName || tx.userEmail || '—'}</TableCell>
                <TableCell className="text-right">{formatEuro(tx.amountCents)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
