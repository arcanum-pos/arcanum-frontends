import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatEuro } from '@/shared/format'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { KASSA_MESSAGES } from './messages'
import { filterOverview, OVERVIEW_FILTERS, overviewTotals, startOfDay, tabStatusKind, type OverviewFilter, type TabStatusKind } from './overview'
import { getTab, listTabsSince, netQuantity, tabTitle, type TabDetail, type TabSummary } from './tabs-api'

const BADGE: Record<TabStatusKind, string> = {
  open: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  paying: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
  cancelled: 'bg-muted text-muted-foreground',
}

const GRID = 'grid grid-cols-[64px_minmax(140px,1.5fr)_1fr_90px_1fr_120px_96px] items-center gap-3'

// The Rekeningen overview (design_files "Rekeningen"): today's rekeningen of
// every kassa, newest first. An open one opens on this kassa (`onOpenTab`);
// a paid or cancelled one shows read-only — refunds and reprints come later.
// Reloads whenever `refreshSignal` changes (a tabs_changed push, Vernieuwen).
export function TabsOverview({ orgId, refreshSignal, onOpenTab }: { orgId: string; refreshSignal: number; onOpenTab: (tabId: string) => void }) {
  const m = useMessages(KASSA_MESSAGES)
  const { locale } = useLocale()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; tabs: TabSummary[] }>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OverviewFilter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listTabsSince(orgId, startOfDay())
      .then((tabs) => !cancelled && setState({ kind: 'ready', tabs }))
      // A failed reload keeps what's on screen; only a first load shows the error.
      .catch(() => !cancelled && setState((s) => (s.kind === 'ready' ? s : { kind: 'failed' })))
    return () => {
      cancelled = true
    }
  }, [orgId, refreshSignal])

  const time = (iso: string) => new Date(iso).toLocaleTimeString(INTL_LOCALES[locale], { hour: '2-digit', minute: '2-digit' })
  const tabs = state.kind === 'ready' ? state.tabs : []
  const shown = filterOverview(m, tabs, query, filter)
  const totals = overviewTotals(tabs)

  return (
    <div className="flex flex-col gap-4" data-testid="tabs-overview">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{m.overviewTitle}</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{m.overviewSubtitle}</p>
        </div>
        <div className="flex-1" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={m.overviewSearch}
          aria-label={m.overviewSearch}
          autoComplete="off"
          className="h-9 w-full max-w-[280px] rounded-lg border bg-card px-3 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {OVERVIEW_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-8 rounded-lg border px-3 text-[13px] font-medium transition-colors',
              filter === f ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground/80 hover:bg-muted'
            )}
          >
            {m.overviewFilters[f]}
          </button>
        ))}
        {state.kind === 'ready' && (
          <p className="ml-auto font-mono text-[12.5px] text-muted-foreground" data-testid="overview-totals">
            {m.overviewTotals(totals.paidCount, formatEuro(totals.paidCents), totals.openCount, formatEuro(totals.openCents))}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[760px]">
          <div className={cn(GRID, 'border-b bg-muted/40 px-4 py-2.5 text-[11.5px] font-semibold text-foreground/70')}>
            <span>{m.overviewColumns.time}</span>
            <span>{m.overviewColumns.tab}</span>
            <span>{m.overviewColumns.kassa}</span>
            <span>{m.overviewColumns.items}</span>
            <span>{m.overviewColumns.method}</span>
            <span>{m.overviewColumns.status}</span>
            <span className="text-right">{m.overviewColumns.amount}</span>
          </div>

          {state.kind === 'loading' && <p className="px-4 py-8 text-center text-[13.5px] text-muted-foreground">{m.loading}</p>}
          {state.kind === 'failed' && <p className="px-4 py-8 text-center text-[13.5px] font-medium text-destructive">{m.overviewFailed}</p>}
          {state.kind === 'ready' && shown.length === 0 && (
            <p className="px-4 py-8 text-center text-[13.5px] text-muted-foreground">{tabs.length === 0 ? m.overviewEmpty : m.overviewNoMatches}</p>
          )}

          {shown.map((tab) => {
            const kind = tabStatusKind(tab)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => (kind === 'open' || kind === 'paying' ? onOpenTab(tab.id) : setDetailId(tab.id))}
                className={cn(GRID, 'w-full border-b border-border/60 px-4 py-3 text-left text-[13.5px] transition-colors last:border-b-0 hover:bg-muted/60')}
                data-testid="overview-row"
              >
                <span className="font-mono text-muted-foreground tabular-nums">{time(tab.openedAt)}</span>
                <span className="truncate font-medium">{tabTitle(m, tab)}</span>
                <span className="truncate text-foreground/75">{tab.openedDeviceName || '—'}</span>
                <span className="text-foreground/75">{m.items(tab.itemCount ?? 0)}</span>
                <span className="truncate text-foreground/75">{(tab.methods ?? []).map((x) => m.methods[x as keyof typeof m.methods] ?? x).join(' + ') || '—'}</span>
                <span>
                  <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold', BADGE[kind])}>{m.overviewStatus[kind]}</span>
                </span>
                <span className="text-right font-mono font-semibold tabular-nums">{formatEuro(tab.totalCents)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <TabDetailDialog key={detailId ?? 'closed'} orgId={orgId} tabId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

// A paid or cancelled rekening, read-only: its lines, its payments, and
// when and where it was opened and closed.
function TabDetailDialog({ orgId, tabId, onClose }: { orgId: string; tabId: string | null; onClose: () => void }) {
  const m = useMessages(KASSA_MESSAGES)
  const { locale } = useLocale()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; tab: TabDetail }>({ kind: 'loading' })

  useEffect(() => {
    if (!tabId) return
    let cancelled = false
    getTab(orgId, tabId)
      .then((tab) => !cancelled && setState({ kind: 'ready', tab }))
      .catch(() => !cancelled && setState({ kind: 'failed' }))
    return () => {
      cancelled = true
    }
  }, [orgId, tabId])

  const time = (iso: string) => new Date(iso).toLocaleTimeString(INTL_LOCALES[locale], { hour: '2-digit', minute: '2-digit' })
  const tab = state.kind === 'ready' ? state.tab : null
  const lines = (tab?.lines ?? []).filter((l) => !l.voidsLineId)

  return (
    <Dialog open={tabId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto" data-testid="tab-detail">
        <DialogHeader>
          <DialogTitle>{tab ? tabTitle(m, tab) : m.loading}</DialogTitle>
          {tab && (
            <DialogDescription>
              {[
                m.detailOpened(time(tab.openedAt), tab.openedDeviceName),
                tab.closedAt && (tab.status === 'cancelled' ? m.detailCancelled(tab.cancelReason ?? null) : m.detailClosed(time(tab.closedAt))),
                tab.receiptNumber !== null && m.detailReceipt(tab.receiptNumber),
              ]
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          )}
        </DialogHeader>

        {state.kind === 'failed' && <p className="text-sm font-medium text-destructive">{m.detailFailed}</p>}

        {tab && (
          <div className="flex flex-col gap-4">
            <section>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{m.detailLines}</p>
              <ul className="rounded-lg border">
                {lines.map((line) => {
                  const qty = netQuantity(line)
                  return (
                    <li key={line.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[13.5px] last:border-b-0">
                      <span className={cn('min-w-0 flex-1', qty === 0 && 'text-muted-foreground line-through')}>
                        {qty || line.quantity} × {line.name}
                        {line.voidedQuantity > 0 && qty > 0 && <span className="ml-2 text-[12px] text-muted-foreground">{m.voided(line.voidedQuantity)}</span>}
                      </span>
                      <span className="font-mono tabular-nums">{formatEuro(qty * line.unitPriceCents)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{m.detailPayments}</p>
              {(tab.payments ?? []).length === 0 ? (
                <p className="text-[13.5px] text-muted-foreground">{m.detailNoPayments}</p>
              ) : (
                <ul className="rounded-lg border">
                  {(tab.payments ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[13.5px] last:border-b-0" data-testid="detail-payment">
                      <span className="w-12 font-mono text-muted-foreground tabular-nums">{time(p.resolvedAt ?? p.createdAt)}</span>
                      <span className="flex-1">
                        {m.methods[p.method as keyof typeof m.methods] ?? p.method}
                        <span className="ml-2 text-[12px] text-muted-foreground">{m.paymentStatuses[p.status] ?? p.status}</span>
                      </span>
                      <span className={cn('font-mono tabular-nums', p.status !== 'succeeded' && 'text-muted-foreground line-through')}>{formatEuro(p.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="text-[13px] text-foreground/70">{m.overviewColumns.amount}</span>
              <span className="font-mono text-xl font-semibold tabular-nums">{formatEuro(tab.totalCents)}</span>
            </div>
            <Button variant="outline" onClick={onClose}>
              {m.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
