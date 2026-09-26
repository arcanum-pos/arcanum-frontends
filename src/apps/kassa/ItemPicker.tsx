import { useState } from 'react'
import { cn } from 'cn'
import { formatEuro } from '@/shared/format'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import { entryToPickerItem, filterSections, searchPick, type PickerItem } from './lib'

export type CatalogState = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | { status: 'ok'; catalog: KassaCatalog }

// Left half of the kassa: the loaded catalog, one card per section (the
// kassa layout's "Groep"), taps add to the active tab's draft. The tab
// panel on the right only ever sees generic lines. An entry with quick
// quantities (e.g. 5/10/…/40 bonnen) gets big "sell N at once" tiles
// instead of a single row. Styled after design_files/ (Kassa + CFD voorstel).
export function ItemPicker({
  catalogState,
  quantities,
  disabled,
  onAdd,
  onRemove,
}: {
  catalogState: CatalogState
  // Quantity of each variant in the current draft — shown next to the product.
  quantities: Record<string, number>
  disabled: boolean
  onAdd: (item: PickerItem, quantity: number) => void
  // Right-click: take it off the order again (only what's not submitted yet).
  onRemove: (item: PickerItem, quantity: number) => void
}) {
  if (catalogState.status === 'loading') return <p className="py-10 text-center text-sm text-muted-foreground">Menukaart laden…</p>
  if (catalogState.status === 'none') {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Nog geen menukaart — een beheerder maakt er een in de console.
      </div>
    )
  }
  if (catalogState.status === 'error') return <p className="text-sm font-medium text-destructive">{catalogState.message}</p>
  return <Catalog catalog={catalogState.catalog} quantities={quantities} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
}

// The loaded catalog with its search field and group chips (design_files:
// "Zoek product of typ een code…" + Alles / one chip per group).
function Catalog({
  catalog,
  quantities,
  disabled,
  onAdd,
  onRemove,
}: {
  catalog: KassaCatalog
  quantities: Record<string, number>
  disabled: boolean
  onAdd: Change
  onRemove: Change
}) {
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  // A group that's gone after a catalog reload falls back to "Alles".
  const group = chosen && catalog.sections.some((s) => s.id === chosen) ? chosen : null
  const sections = filterSections(catalog.sections, query, group)

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
          placeholder="Zoek product of typ een code…"
          aria-label="Zoek product"
          autoComplete="off"
          className="h-[38px] min-w-[180px] flex-[1_1_220px] rounded-[9px] border bg-card px-3 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
        />
        {catalog.sections.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Groep">
            <button type="button" aria-pressed={group === null} className={chip(group === null)} onClick={() => setChosen(null)}>
              Alles
            </button>
            {catalog.sections.map((s) => (
              <button key={s.id} type="button" aria-pressed={group === s.id} className={chip(group === s.id)} onClick={() => setChosen(group === s.id ? null : s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-[13.5px] text-muted-foreground">
          {query.trim() ? `Geen producten gevonden voor “${query.trim()}”.` : 'Geen producten in deze groep.'}
        </div>
      ) : (
        // Plain auto-fill tracks, like the design (no min()/percentages — Safari
        // mis-sized the cards' height with those, showing one row until hover).
        <div className="grid items-start gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {sections.map((section) => {
            const quick = section.entries.filter((e) => e.quickQuantities?.length)
            const plain = section.entries.filter((e) => !e.quickQuantities?.length)
            return (
              <section key={section.id} className={cn('rounded-xl border bg-card', quick.length > 0 && 'col-span-full')}>
                <div className="flex items-center justify-between rounded-t-xl border-b bg-muted/40 px-3.5 py-2.5">
                  <h2 className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{section.name}</h2>
                  <span className="font-mono text-[11px] text-muted-foreground" aria-hidden="true">
                    {section.entries.length}
                  </span>
                </div>
                {quick.map((entry) => (
                  <QuickEntry key={entry.entryId} entry={entry} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
                ))}
                {plain.length > 0 && (
                  <div className="flex flex-col">
                    {plain.map((entry) => (
                      <EntryRow key={entry.entryId} entry={entry} quantity={quantities[entry.variantId] || 0} disabled={disabled} onAdd={onAdd} onRemove={onRemove} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Change = (item: PickerItem, quantity: number) => void

// Click adds, right-click takes off again — the browser menu never opens on a product.
const removeOnRightClick = (disabled: boolean, remove: () => void) => (e: React.MouseEvent) => {
  e.preventDefault()
  if (!disabled) remove()
}

function EntryRow({ entry, quantity, disabled, onAdd, onRemove }: { entry: KassaEntry; quantity: number; disabled: boolean; onAdd: Change; onRemove: Change }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title="Klik: +1 · rechtsklik: −1"
      onClick={() => onAdd(entryToPickerItem(entry), 1)}
      onContextMenu={removeOnRightClick(disabled, () => onRemove(entryToPickerItem(entry), 1))}
      className="flex min-h-12 w-full items-center gap-2.5 border-b border-border/60 px-3.5 py-2.5 text-left transition-colors outline-none last:rounded-b-xl last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted active:bg-muted disabled:opacity-50"
    >
      {/* Already on the order: "2×" — decorative, the ticket lists it too. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[22px] min-w-[26px] items-center justify-center rounded-md px-1.5 font-mono text-[11.5px] font-semibold',
          quantity ? 'bg-foreground text-background' : 'bg-muted'
        )}
      >
        {quantity ? `${quantity}×` : ''}
      </span>
      <span className="flex-1 text-[13.5px] font-medium tracking-tight">{entry.name}</span>
      <span className="font-mono text-[13px] text-foreground/70 tabular-nums">{formatEuro(entry.priceCents)}</span>
    </button>
  )
}

function QuickEntry({ entry, disabled, onAdd, onRemove }: { entry: KassaEntry; disabled: boolean; onAdd: Change; onRemove: Change }) {
  const item = entryToPickerItem(entry)
  return (
    <div className="flex flex-col gap-3 p-3.5">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{entry.name}</span> · {formatEuro(entry.priceCents)} per stuk · tik een aantal
      </p>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {entry.quickQuantities!.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} × ${entry.name}`}
            disabled={disabled}
            title={`Klik: +${n} · rechtsklik: −${n}`}
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
