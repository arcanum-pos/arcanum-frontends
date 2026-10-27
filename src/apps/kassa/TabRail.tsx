import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { cn } from 'cn'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { KASSA_MESSAGES } from './messages'
import { shownNumber, tabTitle, type TabSummary } from './tabs-api'

// 'quick' is the permanent Toog row: not a server tab yet, just a draft —
// paying it creates a brand-new tab each time, so a paid tab is never reused
// (DOMAIN_MODEL.md). Everything else is a real open tab's id.
export type ActiveKey = 'quick' | string

// The open tabs, in a column on the left (KASSA_REDESIGN.md, phase 1): one
// search for a name or a number ("#12": a guest says their number, a
// self-order or a tab of the event), the Toog, every open tab with what's on
// it and since when, and a new tab at the bottom. Below the lg breakpoint
// (a phone, a tablet upright) the same rows run across, above the menu.
export function TabRail({
  tabs,
  active,
  draftCounts,
  quickTotalCents,
  disabled,
  onSelect,
  onNew,
}: {
  tabs: TabSummary[]
  active: ActiveKey
  // Units not sent yet per tab on this kassa ('quick' = the Toog) — shown so they aren't forgotten.
  draftCounts: Record<string, number>
  // What's on the Toog draft right now (0 = nothing yet).
  quickTotalCents: number
  disabled: boolean
  onSelect: (key: ActiveKey) => void
  onNew: () => void
}) {
  const m = useMessages(KASSA_MESSAGES)
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)
  const typed = query.replace('#', '').trim().toLowerCase()
  const shown = typed ? tabs.filter((t) => String(shownNumber(t)) === typed || String(t.number) === typed || tabTitle(m, t).toLowerCase().includes(typed)) : tabs

  // Enter: the tab with that number, else the only one that matches.
  function open(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(typed)
    const byNumber = Number.isInteger(n) && n > 0 ? (tabs.find((t) => shownNumber(t) === n) ?? tabs.find((t) => t.number === n)) : undefined
    const tab = byNumber ?? (shown.length === 1 ? shown[0] : undefined)
    if (tab) {
      setQuery('')
      setNotFound(false)
      onSelect(tab.id)
    } else setNotFound(true)
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <aside
      className="flex w-full shrink-0 flex-col gap-2.5 border-b bg-card/60 p-3 lg:min-h-0 lg:w-[200px] lg:border-r lg:border-b-0 xl:w-[248px]"
      aria-label={m.openTabs}
      data-testid="tab-rail"
    >
      <form onSubmit={open} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setNotFound(false)
          }}
          disabled={disabled}
          placeholder={m.searchTabs}
          aria-label={m.searchTabs}
          aria-invalid={notFound}
          className={cn(
            'h-10 w-full rounded-[10px] border bg-muted/70 pr-3 pl-9 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            notFound && 'border-destructive'
          )}
        />
        {notFound && (
          <p className="mt-1 px-1 text-[12px] text-destructive" role="alert">
            {m.findOrderNotFound(query.replace('#', '').trim())}
          </p>
        )}
      </form>

      <div className="flex gap-1 overflow-x-auto lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
        <Row active={active === 'quick'} disabled={disabled} onClick={() => onSelect('quick')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-[15px] font-bold text-background" aria-hidden="true">
            €
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold">{m.quickSale}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{m.payDirectly}</span>
          </span>
          <Side amount={quickTotalCents > 0 ? formatEuro(quickTotalCents) : ''} fresh={draftCounts.quick} />
        </Row>

        <p className="hidden justify-between px-2 pt-2 pb-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase lg:flex">
          <span>{m.openTabs}</span>
          <span className="tabular-nums">{tabs.length}</span>
        </p>
        {shown.map((tab) => (
          <Row key={tab.id} active={active === tab.id} disabled={disabled} onClick={() => onSelect(tab.id)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{tabTitle(m, tab)}</span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {tab.paymentPending
                  ? m.paymentRunning
                  : [tab.itemCount !== undefined && m.items(tab.itemCount), time(tab.openedAt), tab.split && m.splitPaid(tab.split.paid, tab.split.parts)].filter(Boolean).join(' · ')}
              </span>
            </span>
            <Side amount={formatEuro(tab.outstandingCents)} fresh={draftCounts[tab.id]} />
          </Row>
        ))}
        {typed && shown.length === 0 && <p className="px-2 py-3 text-[13px] text-muted-foreground">{m.noTabsFound}</p>}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onNew}
        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border bg-card text-[14px] font-semibold shadow-xs transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {m.newTab.replace(/^\+\s*/, '')}
      </button>
    </aside>
  )
}

function Row({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-14 w-56 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-50 lg:w-full',
        active ? 'bg-foreground/[0.08] ring-1 ring-foreground/25 ring-inset' : 'hover:bg-muted'
      )}
    >
      {children}
    </button>
  )
}

// The amount, and what this kassa still has to send ("2 nieuw").
function Side({ amount, fresh }: { amount: string; fresh?: number }) {
  const m = useMessages(KASSA_MESSAGES)
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {amount && <span className="text-[14px] font-semibold tabular-nums">{amount}</span>}
      {!!fresh && <span className="rounded-md bg-foreground px-1.5 py-px text-[11px] font-semibold text-background">{m.newItems(fresh)}</span>}
    </span>
  )
}
