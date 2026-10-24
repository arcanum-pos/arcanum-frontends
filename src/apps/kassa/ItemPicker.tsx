import { useEffect, useRef, useState } from 'react'
import { GripVertical, LayoutGrid } from 'lucide-react'
import { cn } from 'cn'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import { entryToPickerItem, filterSections, searchPick, type PickerItem } from './lib'
import { KASSA_MESSAGES } from './messages'
import { GroupColumns, type Grip } from './GroupColumns'
import { columnsThatFit, placeRows, readLayout, writeLayout, type GroupLayout, type Rows } from './layout'
import { groupColor, type TileSize } from './prefs'

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
  group,
  onGroup,
  tiles = 'compact',
  counts = true,
  onAdd,
  onRemove,
}: {
  catalogState: CatalogState
  // The group shown (null: Alles) - chosen in the header on a big screen, here below.
  group: string | null
  onGroup: (group: string | null) => void
  tiles?: TileSize
  counts?: boolean
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
  return <Catalog catalog={catalogState.catalog} quantities={quantities} onTab={onTab} disabled={disabled} chosen={group} onGroup={onGroup} tiles={tiles} counts={counts} onAdd={onAdd} onRemove={onRemove} />
}

// The groups as one segmented control, in the kassa's header on a wide
// screen (from 1280 px) (KASSA_REDESIGN.md, phase 2): Alles, then one per group.
export function GroupTabs({ catalogState, group, onGroup, className }: { catalogState: CatalogState; group: string | null; onGroup: (group: string | null) => void; className?: string }) {
  const m = useMessages(KASSA_MESSAGES)
  if (catalogState.status !== 'ok' || catalogState.catalog.sections.length < 2) return null
  const sections = catalogState.catalog.sections
  const shown = group && sections.some((s) => s.id === group) ? group : null
  const tab = (active: boolean) =>
    cn(
      'h-10 min-w-20 shrink-0 rounded-[9px] px-4 text-[14.5px] whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
      active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'
    )
  return (
    <div className={cn('flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-muted p-[3px]', className)} role="group" aria-label={m.group} data-testid="group-tabs">
      <button type="button" aria-pressed={shown === null} className={tab(shown === null)} onClick={() => onGroup(null)}>
        {m.all}
      </button>
      {sections.map((s) => (
        <button key={s.id} type="button" aria-pressed={shown === s.id} className={tab(shown === s.id)} onClick={() => onGroup(shown === s.id ? null : s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  )
}

// The loaded catalog with its search field, and (on a small screen, where the
// header has no room) the group chips.
function Catalog({
  catalog,
  quantities,
  onTab,
  disabled,
  chosen,
  onGroup,
  tiles,
  counts,
  onAdd,
  onRemove,
}: {
  catalog: KassaCatalog
  quantities: Record<string, number>
  onTab: Record<string, number>
  disabled: boolean
  chosen: string | null
  onGroup: (group: string | null) => void
  tiles: TileSize
  counts: boolean
  onAdd: Change
  onRemove: Change
}) {
  const m = useMessages(KASSA_MESSAGES)
  const [query, setQuery] = useState('')
  const setChosen = onGroup
  // Each group's colour, by its place in the menu (whatever is filtered).
  const colorOf = (id: string) => groupColor(catalog.sections.findIndex((s) => s.id === id))
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
  // Every group can be moved, into any row and column; a group with "sell N
  // at once" tiles starts in a full-width row of its own above the others.
  const canArrange = everything && sections.length > 1
  const ownColumns = canArrange && (layout !== null || arranging)
  const rows = ownColumns
    ? placeRows(
        sections.map((s) => s.id),
        new Set(sections.filter(hasQuick).map((s) => s.id)),
        layout,
        columnsThatFit(gridWidth)
      )
    : []
  function saveRows(next: Rows) {
    const l = { rows: next }
    setLayout(l)
    writeLayout(catalog.id, l)
  }
  // Kept as it is: an empty column is room on purpose, until it's removed.
  // Nothing arranged (or Standaardindeling): the automatic flow stays.
  function finishArranging() {
    if (layout) saveRows(rows)
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
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 xl:hidden" role="group" aria-label={m.group}>
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
          <button type="button" className={chip(false)} onClick={() => saveRows([...rows, [[]]])} data-testid="add-row">
            {m.addRow}
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
              <GroupColumns
                rows={rows}
                arranging={arranging}
                onChange={saveRows}
                nameOf={(id) => sections.find((s) => s.id === id)?.name ?? ''}
                labels={{ dropHere: m.dropHere, addColumn: m.addColumn, removeColumn: m.removeColumn, removeRow: m.removeRow, emptyColumn: m.emptyColumn }}
                renderSection={(id, grip) => {
                  const section = sections.find((s) => s.id === id)!
                  return <SectionCard section={section} color={colorOf(id)} tiles={tiles} counts={counts} quantities={quantities} onTab={onTab} disabled={locked} onAdd={onAdd} onRemove={onRemove} grip={grip} gripLabel={m.moveGroup(section.name)} />
                }}
              />
            </>
          ) : (
            // Not arranged: one group under the other, each the whole width (the design).
            <div className="flex flex-col gap-4">
              {sections.map((section) => (
                <SectionCard key={section.id} section={section} color={colorOf(section.id)} tiles={tiles} counts={counts} quantities={quantities} onTab={onTab} disabled={locked} onAdd={onAdd} onRemove={onRemove} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Change = (item: PickerItem, quantity: number) => void

// One group of the menu (KASSA_REDESIGN.md, phase 2): a box in a light tint
// of its colour, its initial and name on top, its products as tiles (or its
// "sell N at once" tiles). While arranging, a grip in its header drags it
// (GroupColumns).
function SectionCard({
  section,
  color,
  tiles,
  counts,
  quantities,
  onTab,
  disabled,
  onAdd,
  onRemove,
  grip,
  gripLabel,
}: {
  section: KassaCatalog['sections'][number]
  color: string
  tiles: TileSize
  counts: boolean
  quantities: Record<string, number>
  onTab: Record<string, number>
  disabled: boolean
  onAdd: Change
  onRemove: Change
  grip?: Grip
  gripLabel?: string
}) {
  const m = useMessages(KASSA_MESSAGES)
  const quick = section.entries.filter((e) => e.quickQuantities?.length)
  const plain = section.entries.filter((e) => !e.quickQuantities?.length)
  return (
    <section
      style={{ '--group': color } as React.CSSProperties}
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--group)_9%,var(--card))] p-3 dark:bg-[color-mix(in_oklab,var(--group)_20%,var(--card))]',
        quick.length > 0 && 'col-span-full',
        grip && 'ring-1 ring-foreground/10'
      )}
      data-testid="menu-group"
    >
      <div className="flex items-center gap-2.5 px-1">
        {grip && (
          <button
            type="button"
            aria-label={gripLabel}
            {...grip.attributes}
            {...grip.listeners}
            className="-my-1.5 -ml-1.5 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-foreground/60 outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            data-testid="group-grip"
          >
            <GripVertical className="size-5" aria-hidden="true" />
          </button>
        )}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--group)] text-[14px] font-bold text-white" aria-hidden="true">
          {section.name.trim().charAt(0).toUpperCase()}
        </span>
        <h2 className="min-w-0 truncate text-[16px] font-bold tracking-tight">{section.name}</h2>
        <span className="shrink-0 text-[13px] text-muted-foreground">{m.productCount(section.entries.length)}</span>
      </div>
      {quick.map((entry) => (
        <QuickEntry key={entry.entryId} entry={entry} drafted={quantities[entry.variantId] || 0} sent={onTab[entry.variantId] || 0} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
      ))}
      {plain.length > 0 && (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN[tiles]}px, 1fr))` }}>
          {plain.map((entry) => (
            <EntryTile key={entry.entryId} entry={entry} tiles={tiles} counts={counts} drafted={quantities[entry.variantId] || 0} sent={onTab[entry.variantId] || 0} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  )
}

// The narrowest a tile gets: as many across as fit.
const TILE_MIN: Record<TileSize, number> = { large: 150, compact: 118, list: 220 }

// Click adds, right-click takes off again — the browser menu never opens on a product.
const removeOnRightClick = (disabled: boolean, remove: () => void) => (e: React.MouseEvent) => {
  e.preventDefault()
  if (!disabled) remove()
}

const tileBase =
  'rounded-xl bg-card text-left shadow-[0_1px_2px_rgba(0,0,0,.06),0_3px_10px_rgba(0,0,0,.05)] ring-1 ring-foreground/5 transition-[transform,box-shadow] outline-none hover:shadow-[0_2px_4px_rgba(0,0,0,.08),0_8px_20px_rgba(0,0,0,.08)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[.97] disabled:opacity-50 disabled:active:scale-100 dark:ring-white/10'

// One product. `sent`: already on the tab; `drafted`: in the round being
// tapped (the only part right-click can take off again — sent lines need a
// void with a reason). Its parts in reading order (count, name, new, price);
// tiles place them in a grid: the counts on top, the name and price below.
function EntryTile({
  entry,
  tiles,
  counts,
  drafted,
  sent,
  disabled,
  onAdd,
  onRemove,
}: {
  entry: KassaEntry
  tiles: TileSize
  counts: boolean
  drafted: number
  sent: number
  disabled: boolean
  onAdd: Change
  onRemove: Change
}) {
  const m = useMessages(KASSA_MESSAGES)
  const total = drafted + sent
  const list = tiles === 'list'
  return (
    <button
      type="button"
      disabled={disabled}
      title={m.entryHint}
      onClick={() => onAdd(entryToPickerItem(entry), 1)}
      onContextMenu={removeOnRightClick(disabled, () => onRemove(entryToPickerItem(entry), 1))}
      className={cn(
        tileBase,
        list
          ? 'flex min-h-14 items-center gap-2.5 px-3 py-2'
          : cn('grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-x-2 px-3 pt-2.5 pb-2.5', tiles === 'large' ? 'h-[calc(128px*var(--kassa-text,1))]' : 'h-[calc(108px*var(--kassa-text,1))]')
      )}
    >
      {/* On the tab, all told: "3×" — dark while some of it is new, grey when
          it's all sent; the new part beside it ("+1"). Decorative: the ticket
          lists it too. Fixed sizes, whatever the counts say: a tap never moves anything. */}
      <span
        aria-hidden="true"
        data-testid="entry-count"
        className={cn(
          'flex h-6 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[12px] leading-none font-semibold tabular-nums',
          !list && 'col-start-1 row-start-1',
          !counts && 'invisible',
          drafted ? 'bg-foreground text-background' : sent ? 'bg-foreground/15 text-foreground' : list && 'bg-muted'
        )}
      >
        {total ? `${total}×` : ''}
      </span>
      <span
        className={cn(
          'min-w-0 font-semibold tracking-tight',
          list ? 'flex-1 truncate text-[calc(15px*var(--kassa-text,1))]' : cn('col-span-3 row-start-2 line-clamp-2 self-end leading-tight', tiles === 'large' ? 'text-[calc(16.5px*var(--kassa-text,1))]' : 'text-[calc(15px*var(--kassa-text,1))]')
        )}
      >
        {entry.name}
      </span>
      <span aria-hidden="true" className={cn('flex h-6 min-w-9 shrink-0 items-center justify-end font-mono text-[12px] leading-none font-semibold tabular-nums', !list && 'col-start-3 row-start-1', !counts && 'invisible')}>
        {drafted > 0 && sent > 0 && (
          <span className="rounded-md bg-foreground px-1.5 py-1 text-background" data-testid="entry-new">
            +{drafted}
          </span>
        )}
      </span>
      <span className={cn('font-mono text-[calc(13px*var(--kassa-text,1))] text-muted-foreground tabular-nums', !list && 'col-span-3 row-start-3 mt-0.5')}>{formatEuro(entry.priceCents)}</span>
    </button>
  )
}

function QuickEntry({ entry, drafted, sent, disabled, onAdd, onRemove }: { entry: KassaEntry; drafted: number; sent: number; disabled: boolean; onAdd: Change; onRemove: Change }) {
  const m = useMessages(KASSA_MESSAGES)
  const item = entryToPickerItem(entry)
  return (
    <div className="flex flex-col gap-2">
      <p className="truncate px-1 text-[13px] leading-5 text-muted-foreground">
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
            className={cn(tileBase, 'flex h-[88px] flex-col items-start justify-between px-3.5 py-3')}
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
