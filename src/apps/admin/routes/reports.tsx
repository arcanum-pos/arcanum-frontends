import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listEvents, listTransactions } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { formatEuro } from '../lib/format'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import {
  fetchSalesReport,
  legacyItemRows,
  methodLabel,
  periodBounds,
  REPORT_FORBIDDEN,
  toDateInput,
  vatLabel,
  type Period,
  type SalesReport,
} from '../lib/reports'

const ALL_EVENTS = '__all__'
const PERIODS: Period[] = ['today', 'yesterday', 'week', 'month', 'custom']

function formatTime(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Sales report for a period (step 3d) on top, the raw payment list below.
// Revenue = order lines of tabs closed in the period (voids subtracted,
// tips excluded); payments = everything the ledger recorded, including
// sales from before tabs existed (shown separately as "oude kassa").
export default function ReportsPage() {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date()))
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()))
  const bounds = periodBounds(period, new Date(), { from: customFrom, to: customTo })
  const boundsKey = bounds ? `${bounds.from}|${bounds.to}` : ''

  const report = useAsync<SalesReport | null>(
    () => (orgId && bounds ? fetchSalesReport(orgId, bounds.from, bounds.to) : Promise.resolve(null)),
    [orgId, boundsKey]
  )
  const forbidden = report.error === REPORT_FORBIDDEN

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.reports.title}</h1>
          <p className="text-muted-foreground">{m.reports.subtitle(currentOrg?.name ?? m.thisOrg)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label={m.reports.period}>
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {m.reports.periods[p]}
            </Button>
          ))}
          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-from">{m.reports.from}</Label>
                <Input id="report-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-to">{m.reports.to}</Label>
                <Input id="report-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
              </div>
            </div>
          )}
        </div>
        {period === 'custom' && !bounds && <p className="text-sm text-destructive">{m.reports.invalidPeriod}</p>}
      </div>

      {forbidden ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{m.reports.forbidden}</CardContent>
        </Card>
      ) : (
        <SalesReportView report={report.data} loading={report.loading} error={report.error} />
      )}

      <TransactionList orgId={orgId} bounds={bounds} />
    </div>
  )
}

function Amount({ loading, cents }: { loading: boolean; cents: number | undefined }) {
  return loading || cents === undefined ? <Skeleton className="h-8 w-24" /> : <>{formatEuro(cents)}</>
}

function SalesReportView({ report, loading, error }: { report: SalesReport | null; loading: boolean; error: string | null }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  if (error) return <p className="text-sm text-destructive">{m.reports.loadError(error)}</p>
  const r = loading ? null : report
  const legacyRows = r ? legacyItemRows(m, r.legacy.items) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{m.reports.revenue}</CardDescription>
            <CardTitle className="text-2xl" data-testid="kpi-revenue">
              <Amount loading={!r} cents={r ? r.sales.revenueCents + r.legacy.amountCents - (r.legacy.items.fooi ?? 0) : undefined} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {r ? m.reports.closedTabs(r.sales.tabCount, r.legacy.count > 0) : ''}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{m.reports.tips}</CardDescription>
            <CardTitle className="text-2xl" data-testid="kpi-tips">
              <Amount loading={!r} cents={r ? r.payments.tipCents + (r.legacy.items.fooi ?? 0) : undefined} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{m.reports.paymentsTotal}</CardDescription>
            <CardTitle className="text-2xl" data-testid="kpi-payments">
              <Amount loading={!r} cents={r?.payments.amountCents} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{r ? m.reports.paymentCount(r.payments.count) : ''}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{m.reports.openTabs}</CardDescription>
            <CardTitle className="text-2xl" data-testid="kpi-open">
              <Amount loading={!r} cents={r?.openTabs.outstandingCents} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{r ? m.reports.openCount(r.openTabs.count) : ''}</CardContent>
        </Card>
      </div>

      {r && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.byMethod}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table data-testid="report-methods">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.reports.method}</TableHead>
                    <TableHead className="text-right">{m.reports.quantity}</TableHead>
                    <TableHead className="text-right">{m.reports.amount}</TableHead>
                    <TableHead className="text-right">{m.reports.ofWhichTip}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.payments.byMethod.length === 0 && <EmptyRow cols={4} />}
                  {r.payments.byMethod.map((row) => (
                    <TableRow key={row.method}>
                      <TableCell>{methodLabel(m, row.method)}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{formatEuro(row.amountCents)}</TableCell>
                      <TableCell className="text-right">{formatEuro(row.tipCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.byCategory}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table data-testid="report-categories">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.reports.category}</TableHead>
                    <TableHead className="text-right">{m.reports.quantity}</TableHead>
                    <TableHead className="text-right">{m.reports.revenueShort}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.sales.byCategory.length === 0 && <EmptyRow cols={3} />}
                  {r.sales.byCategory.map((c) => (
                    <TableRow key={c.category ?? '—'}>
                      <TableCell>{c.category ?? m.reports.noCategory}</TableCell>
                      <TableCell className="text-right">{c.quantity}</TableCell>
                      <TableCell className="text-right">{formatEuro(c.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{m.reports.byProduct}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table data-testid="report-products">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.reports.product}</TableHead>
                    <TableHead className="hidden sm:table-cell">{m.reports.category}</TableHead>
                    <TableHead className="text-right">{m.reports.quantity}</TableHead>
                    <TableHead className="text-right">{m.reports.revenueShort}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.sales.byProduct.length === 0 && <EmptyRow cols={4} />}
                  {r.sales.byProduct.map((p) => (
                    <TableRow key={`${p.name}|${p.category ?? ''}`}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.category ?? '—'}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">{formatEuro(p.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.byVat}</CardTitle>
              <CardDescription>{m.reports.vatProvisional}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table data-testid="report-vat">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.reports.vatRate}</TableHead>
                    <TableHead className="text-right">{m.reports.revenueInclVat}</TableHead>
                    <TableHead className="text-right">{m.reports.vat}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.sales.byVat.length === 0 && <EmptyRow cols={3} />}
                  {r.sales.byVat.map((v) => (
                    <TableRow key={String(v.vatRateBp)}>
                      <TableCell>{vatLabel(m, v.vatRateBp)}</TableCell>
                      <TableCell className="text-right">{formatEuro(v.revenueCents)}</TableCell>
                      <TableCell className="text-right">{v.vatRateBp === null ? '—' : formatEuro(v.vatCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {r.legacy.count > 0 && (
            <Card data-testid="report-legacy">
              <CardHeader>
                <CardTitle className="text-base">{m.reports.legacyTitle}</CardTitle>
                <CardDescription>{m.reports.legacySummary(r.legacy.count, formatEuro(r.legacy.amountCents))}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {legacyRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right">{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center text-muted-foreground">
        {m.reports.nothingInPeriod}
      </TableCell>
    </TableRow>
  )
}

// The raw payment list for the same period, optionally narrowed to one
// event (a sale carries the event its kassa had chosen when the rekening
// was opened — Instellingen → Evenement).
function TransactionList({ orgId, bounds }: { orgId: string | null; bounds: { from: string; to: string } | null }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const intlLocale = INTL_LOCALES[useLocale().locale]
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

  const inPeriod = (transactions ?? []).filter((t) => !bounds || (t.completedAt >= bounds.from && t.completedAt < bounds.to))
  const sorted = [...inPeriod].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{m.reports.paymentsInPeriod}</h2>
        {events && events.length > 0 && (
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={m.reports.event} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENTS}>{m.reports.allEvents}</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} — {formatDate(event.date, intlLocale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{m.reports.paymentsLoadError(error)}</p>}

      <Table data-testid="transactions">
        <TableHeader>
          <TableRow>
            <TableHead>{m.reports.time}</TableHead>
            <TableHead>{m.reports.description}</TableHead>
            <TableHead>{m.reports.method}</TableHead>
            <TableHead>{m.reports.device}</TableHead>
            <TableHead>{m.reports.user}</TableHead>
            <TableHead className="text-right">{m.reports.tips}</TableHead>
            <TableHead className="text-right">{m.reports.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {m.reports.noPayments}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            sorted.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatTime(tx.completedAt, intlLocale)}</TableCell>
                <TableCell>{tx.description || '—'}</TableCell>
                <TableCell>{methodLabel(m, tx.method)}</TableCell>
                <TableCell>{tx.deviceName || '—'}</TableCell>
                <TableCell>{tx.userName || tx.userEmail || '—'}</TableCell>
                <TableCell className="text-right">{tx.tipCents ? formatEuro(tx.tipCents) : '—'}</TableCell>
                <TableCell className="text-right">{formatEuro(tx.amountCents)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
