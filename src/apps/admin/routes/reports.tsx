import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { listTransactions } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { formatEuro } from '../lib/format'

const METHOD_LABELS: Record<string, string> = { cash: 'Cash', sumup: 'SumUp', bancontact: 'Bancontact' }

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Just the plain transaction list for now — this is meant to grow into a
// real reports section (see Dashboard for the same "reserved space" idea).
// Deliberately not porting webapp's transactions.astro's event-specific
// bits (bonnen/fietstocht/wandeltocht/fooi counts, tijdvak/slot filtering)
// — those are tied to one event's own product taxonomy, not something
// every org would have.
export default function ReportsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: transactions, loading, error } = useAsync(
    () => (orgId ? listTransactions(orgId) : Promise.resolve([])),
    [orgId]
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapporten</h1>
        <p className="text-muted-foreground">
          Transacties van {currentOrg?.name ?? 'deze organisatie'}. Meer rapportage volgt later.
        </p>
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
