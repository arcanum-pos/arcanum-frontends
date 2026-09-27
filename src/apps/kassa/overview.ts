import { formatEuro } from '@/shared/format'
import { normalizeSearch } from './lib'
import type { KassaMessages } from './messages/nl'
import { tabTitle, type TabSummary } from './tabs-api'

// The Rekeningen overview: every rekening of today, of every kassa of the
// org. "Today" until shifts exist server-side (DOMAIN_MODEL.md) — then the
// shift replaces it.

// Local midnight, as the ISO timestamp the tabs API's `since` takes.
export function startOfDay(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

export type TabStatusKind = 'open' | 'paying' | 'paid' | 'cancelled'

export function tabStatusKind(tab: Pick<TabSummary, 'status' | 'paymentPending'>): TabStatusKind {
  if (tab.status === 'closed') return 'paid'
  if (tab.status === 'cancelled') return 'cancelled'
  return tab.paymentPending ? 'paying' : 'open'
}

// The status chips: "open" includes a payment in progress.
export type OverviewFilter = 'all' | 'open' | 'paid' | 'cancelled'
export const OVERVIEW_FILTERS: OverviewFilter[] = ['all', 'open', 'paid', 'cancelled']

function matchesFilter(tab: TabSummary, filter: OverviewFilter): boolean {
  const kind = tabStatusKind(tab)
  return filter === 'all' || kind === filter || (filter === 'open' && kind === 'paying')
}

// The search: "#12" finds rekening 12; a query of just digits finds an
// amount by its start ("41,50", "41.5", "41" → € 41,50) or that number;
// anything else finds every word in the title as shown ("Tafel 4", a Toog
// sale by its translated name) or the kassa's name.
function matchesQuery(m: Pick<KassaMessages, 'quickSale' | 'tabNumber'>, tab: TabSummary, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const number = q.match(/^#(\d+)$/)
  if (number) return tab.number === Number(number[1])
  if (/^[\d.,]+$/.test(q)) {
    const amount = formatEuro(tab.totalCents).replace('€', '').trim()
    return amount.startsWith(q.replace('.', ',')) || String(tab.number) === q
  }
  const haystack = `${normalizeSearch(tabTitle(m, tab))} ${normalizeSearch(tab.openedDeviceName ?? '')}`
  return normalizeSearch(q)
    .split(' ')
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function filterOverview(m: Pick<KassaMessages, 'quickSale' | 'tabNumber'>, tabs: TabSummary[], query: string, filter: OverviewFilter): TabSummary[] {
  return tabs.filter((t) => matchesFilter(t, filter) && matchesQuery(m, t, query))
}

// The line above the list: what's been paid today, what's still open.
export function overviewTotals(tabs: TabSummary[]) {
  const paid = tabs.filter((t) => t.status === 'closed')
  const open = tabs.filter((t) => t.status === 'open')
  return {
    paidCount: paid.length,
    paidCents: paid.reduce((sum, t) => sum + t.totalCents, 0),
    openCount: open.length,
    openCents: open.reduce((sum, t) => sum + t.outstandingCents, 0),
  }
}
