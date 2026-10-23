import { useEffect, useRef, useState } from 'react'
import { GripVertical, LayoutGrid } from 'lucide-react'
import { cn } from 'cn'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import { entryToPickerItem, filterSections, searchPick, type PickerItem } from './lib'
import { KASSA_MESSAGES } from './messages'
import { GroupColumns, type Grip } from './GroupColumns'
import { columnsThatFit, placeSections, readLayout, writeLayout, type GroupLayout } from './layout'

export type CatalogState = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | { status: 'ok'; catalog: KassaCatalog }

// Left half of the kassa: the loaded catalog, one card per section (the
// kassa layout's "Groep"), taps add to the active tab's draft. The tab
// panel on the right only ever sees generic lines. An entry with quick
// quantities (e.g. 5/10/…/40 bonnen) gets big "sell N at once" tiles
// instead of a single row. Styled after design_files/ (Kassa + CFD voorstel).
export function ItemPicker({
  catalogState,
  quantities,
  onTab = {},
  disabled,
  onAdd,
  onRemove,
}: {
  catalogState: CatalogState
  // Quantity of each variant in the current draft (the round being tapped).
  quantities: Record<string, number>
  // …and already on the selected tab — the menu shows both, the same as the ticket on the right.
  onTab?: Record<string, number>
  disabled: boolean
  onAdd: (item: PickerItem, quantity: number) => void
  // Right-click: take it off the order again (only what's not submitted yet).
  onRemove: (item: PickerItem, quantity: number) => void
}) {
  const m = useMessages(KASSA_MESSAGES)
  if (catalogState.status === 'loading') return <p className="py-10 text-center text-sm text-muted-foreground">{m.catalogLoading}</p>
  if (catalogState.status === 'none') {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        {m.noCatalog}
      </div>
    )
  }
  if (catalogState.status === 'error') return <p className="text-sm font-medium text-destructive">{catalogState.message}</p>
  return <Catalog catalog={catalogState.catalog} quantities={quantities} onTab={onTab} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
}

// The loaded catalog with its search field and group chips (design_files:
// "Zoek product of typ een code…" + Alles / one chip per group).
function Catalog({
  catalog,
  quantities,
  onTab,
  disabled,
  onAdd,
  onRemove,
}: {
  catalog: KassaCatalog
  quantities: Record<string, number>
  onTab: Record<string, number>
  disabled: boolean
  onAdd: Change
  onRemove: Change
}) {
  const m = useMessages(KASSA_MESSAGES)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  // A group that's gone after a catalog reload falls back to "Alles".
  const group = chosen && catalog.sections.some((s) => s.id === chosen) ? chosen : null
  const sections = filterSections(catalog.sections, query, group)

  // This till's own arrangement of the groups (layout.ts) — only with
  // "Alles" and no search; changed in "Indeling aanpassen".
  const [layout, setLayout] = useState<GroupLayout | null>(() => readLayout(catalog.id))
  const [arranging, setArranging] = useState(false)
  useEffect(() => {
    setLayout(readLayout(catalog.id))
    setArranging(false)
  }, [catalog.id])
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const everything = group === null && !query.trim()
  const hasQuick = (s: (typeof sections)[number]) => s.entries.some((e) => e.quickQuantities?.length)
  // Groups with "sell N at once" tiles stay full width, above the columns.
  const movable = sections.filter((s) => !hasQuick(s))
  const canArrange = everything && movable.length > 1
  const ownColumns = canArrange && (layout !== null || arranging)
  const columns = ownColumns ? placeSections(movable.map((s) => s.id), layout, columnsThatFit(gridWidth)) : []
  function saveColumns(next: string[][]) {
    const l = { columns: next }
    setLayout(l)
    writeLayout(catalog.id, l)
  }
  function finishArranging() {
    if (layout) saveColumns(layout.columns.filter((c) => c.length > 0))
    setArranging(false)
  }
  const locked = disabled || arranging

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setQuery('')
    if (e.key !== 'Enter') return
    e.preventDefault()
    // An exact code or the only product left: add it and clear for the next one.
    const pick = searchPick(filterSections(catalog.sections, '', group), query)
    if (pick && !disabled) {
      onAdd(entryToPickerItem(pick), 1)
      setQuery('')
    }
  }

  const chip = (active: boolean) =>
    cn(
      'h-[38px] shrink-0 rounded-[9px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
      active ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground/80 hover:bg-muted'
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder={m.searchPlaceholder}
          aria-label={m.searchLabel}
          autoComplete="off"
          className="h-[38px] min-w-[180px] flex-[1_1_220px] rounded-[9px] border bg-card px-3 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
        />
        {catalog.sections.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label={m.group}>
            <button type="button" aria-pressed={group === null} className={chip(group === null)} onClick={() => setChosen(null)}>
              {m.all}
            </button>
            {catalog.sections.map((s) => (
              <button key={s.id} type="button" aria-pressed={group === s.id} className={chip(group === s.id)} onClick={() => setChosen(group === s.id ? null : s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        {/* Always in its place — only invisible when there's nothing to arrange
            (a group chosen, a search): the search field keeps its width. */}
        <button
          type="button"
          className={cn(chip(false), 'ml-auto flex items-center gap-1.5', (!canArrange || arranging) && 'invisible')}
          aria-hidden={!canArrange || arranging || undefined}
          tabIndex={!canArrange || arranging ? -1 : undefined}
          onClick={() => setArranging(true)}
          data-testid="arrange"
          data-shown={canArrange && !arranging ? true : undefined}
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          {m.arrange}
        </button>
      </div>
      {arranging && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/20 bg-card px-3.5 py-2.5" role="status" data-testid="arrange-bar">
          <p className="min-w-0 flex-[1_1_240px] text-[13px]">{m.arrangeHint}</p>
          <button type="button" className={chip(false)} onClick={() => saveColumns([...columns, []])}>
            {m.addColumn}
          </button>
          <button
            type="button"
            className={chip(false)}
            onClick={() => {
              setLayout(null)
              writeLayout(catalog.id, null)
            }}
          >
            {m.defaultLayout}
          </button>
          <button type="button" className={chip(true)} onClick={finishArranging}>
            {m.done}
          </button>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-[13.5px] text-muted-foreground">
          {query.trim() ? m.noMatches(query.trim()) : m.emptyGroup}
        </div>
      ) : (
        <div ref={gridRef} className="flex flex-col gap-3">
          {ownColumns ? (
            <>
              {sections.filter(hasQuick).map((section) => (
                <SectionCard key={section.id} section={section} quantities={quantities} onTab={onTab} disabled={locked} onAdd={onAdd} onRemove={onRemove} />
              ))}
              <GroupColumns
                columns={columns}
                arranging={arranging}
                onChange={saveColumns}
                nameOf={(id) => sections.find((s) => s.id === id)?.name ?? ''}
                dropHere={m.dropHere}
                renderSection={(id, grip) => {
                  const section = sections.find((s) => s.id === id)!
                  return <SectionCard section={section} quantities={quantities} onTab={onTab} disabled={locked} onAdd={onAdd} onRemove={onRemove} grip={grip} gripLabel={m.moveGroup(section.name)} />
                }}
              />
            </>
          ) : (
            // Plain auto-fill tracks, like the design (no min()/percentages — Safari
            // mis-sized the cards' height with those, showing one row until hover).
            <div className="grid items-start gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {sections.map((section) => (
                <SectionCard key={section.id} section={section} quantities={quantities} onTab={onTab} disabled={locked} onAdd={onAdd} onRemove={onRemove} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Change = (item: PickerItem, quantity: number) => void

// One group of the menu: its products (or its "sell N at once" tiles, full
// width). While arranging, a grip in its header drags it (GroupColumns).
function SectionCard({
  section,
  quantities,
  onTab,
  disabled,
  onAdd,
  onRemove,
  grip,
  gripLabel,
}: {
  section: KassaCatalog['sections'][number]
  quantities: Record<string, number>
  onTab: Record<string, number>
  disabled: boolean
  onAdd: Change
  onRemove: Change
  grip?: Grip
  gripLabel?: string
}) {
  const quick = section.entries.filter((e) => e.quickQuantities?.length)
  const plain = section.entries.filter((e) => !e.quickQuantities?.length)
  return (
    <section className={cn('rounded-xl border bg-card', quick.length > 0 && 'col-span-full', grip && 'ring-1 ring-foreground/10')} data-testid="menu-group">
      <div className="flex items-center justify-between gap-2 rounded-t-xl border-b bg-muted/40 px-3.5 py-2.5">
        {grip && (
          <button
            type="button"
            aria-label={gripLabel}
            {...grip.attributes}
            {...grip.listeners}
            className="-my-2 -ml-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-foreground/60 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            data-testid="group-grip"
          >
            <GripVertical className="size-5" aria-hidden="true" />
          </button>
        )}
        <h2 className="flex-1 text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{section.name}</h2>
        <span className="font-mono text-[11px] text-muted-foreground" aria-hidden="true">
          {section.entries.length}
        </span>
      </div>
      {quick.map((entry) => (
        <QuickEntry key={entry.entryId} entry={entry} drafted={quantities[entry.variantId] || 0} sent={onTab[entry.variantId] || 0} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
      ))}
      {plain.length > 0 && (
        <div className="flex flex-col">
          {plain.map((entry) => (
            <EntryRow key={entry.entryId} entry={entry} drafted={quantities[entry.variantId] || 0} sent={onTab[entry.variantId] || 0} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  )
}

// Click adds, right-click takes off again — the browser menu never opens on a product.
const removeOnRightClick = (disabled: boolean, remove: () => void) => (e: React.MouseEvent) => {
  e.preventDefault()
  if (!disabled) remove()
}

// `sent`: already on the tab; `drafted`: in the round being tapped (the only
// part right-click can take off again — sent lines need a void with a reason).
function EntryRow({ entry, drafted, sent, disabled, onAdd, onRemove }: { entry: KassaEntry; drafted: number; sent: number; disabled: boolean; onAdd: Change; onRemove: Change }) {
  const m = useMessages(KASSA_MESSAGES)
  const total = drafted + sent
  return (
    <button
      type="button"
      disabled={disabled}
      title={m.entryHint}
      onClick={() => onAdd(entryToPickerItem(entry), 1)}
      onContextMenu={removeOnRightClick(disabled, () => onRemove(entryToPickerItem(entry), 1))}
      className="flex min-h-12 w-full items-center gap-2.5 border-b border-border/60 px-3.5 py-2.5 text-left transition-colors outline-none last:rounded-b-xl last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted active:bg-muted disabled:opacity-50"
    >
      {/* On the tab, all told: "3×" — dark while some of it is new, grey when
          it's all sent; the new part beside it ("+1"). Decorative: the ticket lists it too. */}
      {/* Fixed sizes, whatever the counts say: a tap never moves the rows. */}
      <span
        aria-hidden="true"
        data-testid="entry-count"
        className={cn(
          'flex h-[22px] w-9 shrink-0 items-center justify-center rounded-md font-mono text-[11.5px] leading-none font-semibold tabular-nums',
          drafted ? 'bg-foreground text-background' : sent ? 'bg-foreground/15 text-foreground' : 'bg-muted'
        )}
      >
        {total ? `${total}×` : ''}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] leading-5 font-medium tracking-tight">{entry.name}</span>
      <span aria-hidden="true" className="flex h-[22px] w-9 shrink-0 items-center justify-center font-mono text-[11px] leading-none font-semibold tabular-nums">
        {drafted > 0 && sent > 0 && (
          <span className="rounded-md border border-foreground/30 px-1 py-0.5" data-testid="entry-new">
            +{drafted}
          </span>
        )}
      </span>
      <span className="font-mono text-[13px] text-foreground/70 tabular-nums">{formatEuro(entry.priceCents)}</span>
    </button>
  )
}

function QuickEntry({ entry, drafted, sent, disabled, onAdd, onRemove }: { entry: KassaEntry; drafted: number; sent: number; disabled: boolean; onAdd: Change; onRemove: Change }) {
  const m = useMessages(KASSA_MESSAGES)
  const item = entryToPickerItem(entry)
  return (
    <div className="flex flex-col gap-3 p-3.5">
      <p className="truncate text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">{entry.name}</span> · {m.perPiece(formatEuro(entry.priceCents))}
        {drafted + sent > 0 && (
          <span className="ml-1.5 font-mono font-semibold text-foreground" data-testid="entry-count">
            · {m.onTabCount(drafted + sent)}
            {drafted > 0 && sent > 0 && ` (+${drafted})`}
          </span>
        )}
      </p>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {entry.quickQuantities!.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} × ${entry.name}`}
            disabled={disabled}
            title={m.quickHint(n)}
            onClick={() => onAdd(item, n)}
            onContextMenu={removeOnRightClick(disabled, () => onRemove(item, n))}
            className="flex h-[84px] flex-col items-start justify-between rounded-xl border bg-card px-3.5 py-3 text-left transition-colors outline-none hover:border-foreground hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[.985] disabled:opacity-50"
          >
            <span className="font-mono text-[26px] leading-none font-semibold tracking-tight">{n}</span>
            <span className="text-[12.5px] text-muted-foreground">
              {entry.name.toLowerCase()} · {formatEuro(entry.priceCents * n)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
