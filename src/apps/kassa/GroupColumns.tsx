import { useState, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { cn } from 'cn'
import { flatColumns, moveSection, unflatColumns, type Rows } from './layout'

// The menu's groups in this till's own rows and columns (layout.ts). While
// arranging (Indeling aanpassen), each group is dragged by its grip — a
// finger, a mouse, or the keyboard (space, the arrows, space). What's dragged
// follows the pointer as a card; where it will land is always shown: its
// column lit up and a line at the place — above or below the group under the
// pointer, or at the bottom of the column. The whole height of a column takes
// it, and a drop in a gap goes to the nearest column — never back by
// surprise. Nothing moves until it's dropped. Rows and columns are added and
// removed by hand (an empty column is room on purpose until removed).
// Otherwise nothing moves at all and the products are tapped as always.
// `renderSection` draws a group, `grip` the handle to put in its header.
export type Grip = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined } | null

const COLUMN = 'col:'

interface Target {
  column: number
  index: number
}

// The column (or a group in it) under the pointer; else the nearest one.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(COLUMN)) })
}

export interface ArrangeLabels {
  // "Hier neerzetten": said in the column it will land in.
  dropHere: string
  addColumn: string
  removeColumn: string
  removeRow: string
  // An empty column while arranging.
  emptyColumn: string
}

export function GroupColumns({
  rows,
  arranging,
  onChange,
  renderSection,
  nameOf,
  labels,
}: {
  rows: Rows
  arranging: boolean
  onChange: (rows: Rows) => void
  renderSection: (id: string, grip: Grip) => ReactNode
  nameOf: (id: string) => string
  labels: ArrangeLabels
}) {
  // Every row's columns in one list: what a drag moves between.
  const columns = flatColumns(rows)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [dragging, setDragging] = useState<string | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const columnOf = (id: string) => (id.startsWith(COLUMN) ? Number(id.slice(COLUMN.length)) : columns.findIndex((c) => c.includes(id)))

  // Where it would land now: over a group, before or after it (which half
  // the dragged card's middle is in); over a column, at its end.
  function targetOf({ active, over }: Pick<DragOverEvent, 'active' | 'over'>): Target | null {
    if (!over) return null
    const overId = String(over.id)
    const column = columnOf(overId)
    if (column < 0) return null
    const list = columns[column].filter((id) => id !== active.id)
    if (overId.startsWith(COLUMN) || overId === active.id) {
      if (overId === active.id) return { column, index: columns[column].indexOf(overId) }
      return { column, index: list.length }
    }
    const dragged = active.rect.current.translated
    const below = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false
    return { column, index: list.indexOf(overId) + (below ? 1 : 0) }
  }

  function onDragEnd(event: DragEndEvent) {
    const at = targetOf(event)
    setDragging(null)
    setTarget(null)
    if (!at) return
    const next = moveSection(columns, String(event.active.id), at.column, at.index)
    if (JSON.stringify(next) !== JSON.stringify(columns)) onChange(unflatColumns(rows, next))
  }

  function column(i: number, removable: (() => void) | null) {
    const ids = columns[i]
    // The place it would land, counted without the dragged group itself.
    const shown = ids.filter((id) => id !== dragging)
    const line = target?.column === i ? target.index : -1
    return (
      <Column key={i} index={i} arranging={arranging} active={target?.column === i} label={labels.dropHere}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => (
            <div key={id} className="flex flex-col gap-3">
              {dragging !== id && line === shown.indexOf(id) && <DropLine />}
              <SortableGroup id={id} arranging={arranging} dragging={dragging === id} renderSection={renderSection} />
            </div>
          ))}
          {line === shown.length && <DropLine />}
        </SortableContext>
        {arranging && ids.length === 0 && target?.column !== i && (
          <div className="my-auto flex flex-col items-center gap-2 py-3 text-center">
            <p className="text-[12px] font-medium text-foreground/50">{labels.emptyColumn}</p>
            {removable && (
              <button type="button" className={SMALL_BUTTON} onClick={removable} data-testid="remove-column">
                {labels.removeColumn}
              </button>
            )}
          </div>
        )}
      </Column>
    )
  }

  const change = (next: Rows) => onChange(next.length ? next : [[[]]])
  let at = 0

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setDragging(String(active.id))}
      onDragOver={(event) => setTarget(targetOf(event))}
      onDragMove={(event) => setTarget(targetOf(event))}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null)
        setTarget(null)
      }}
    >
      <div className="flex flex-col gap-3" data-testid="group-rows">
        {rows.map((row, r) => {
          const first = at
          at += row.length
          const empty = row.every((c) => c.length === 0)
          // Not arranging: an empty row takes no room; an empty column keeps its place.
          if (!arranging && empty) return null
          return (
            <div key={r} className={cn('flex flex-col gap-2', arranging && 'rounded-2xl bg-muted/40 p-2')} data-testid="group-row">
              {arranging && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" className={SMALL_BUTTON} onClick={() => change(rows.map((x, i) => (i === r ? [...x, []] : x)))} data-testid="add-column">
                    {labels.addColumn}
                  </button>
                  {empty && rows.length > 1 && (
                    <button type="button" className={SMALL_BUTTON} onClick={() => change(rows.filter((_, i) => i !== r))} data-testid="remove-row">
                      {labels.removeRow}
                    </button>
                  )}
                </div>
              )}
              <div className="grid items-stretch gap-3 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': row.length } as React.CSSProperties} data-testid="group-columns">
                {row.map((_, c) => column(first + c, row.length > 1 ? () => change(rows.map((x, i) => (i === r ? x.filter((_, j) => j !== c) : x))) : null))}
              </div>
            </div>
          )
        })}
      </div>
      {/* What's dragged, following the pointer. */}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-3.5 py-3 text-[12px] font-semibold tracking-[0.08em] uppercase shadow-xl" data-testid="drag-card">
            <GripVertical className="size-5" aria-hidden="true" />
            {nameOf(dragging)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Where it will land: a thick line.
function DropLine() {
  return <div className="h-1.5 rounded-full bg-foreground" aria-hidden="true" data-testid="drop-line" />
}

const SMALL_BUTTON =
  'h-8 rounded-lg border bg-card px-2.5 text-[12px] font-medium text-foreground/80 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50'

function Column({ index, arranging, active, label, children }: { index: number; arranging: boolean; active: boolean; label: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN}${index}`, disabled: !arranging })
  return (
    <div
      ref={setNodeRef}
      data-testid="group-column"
      data-target={active || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-3',
        arranging && 'min-h-28 rounded-xl border-2 border-dashed border-foreground/15 bg-background p-1.5 transition-colors',
        active && 'border-solid border-foreground bg-foreground/[0.04]'
      )}
    >
      {children}
      {active && <p className="mt-auto py-1 text-center text-[12px] font-semibold text-foreground/70">{label}</p>}
    </div>
  )
}

function SortableGroup({ id, arranging, dragging, renderSection }: { id: string; arranging: boolean; dragging: boolean; renderSection: (id: string, grip: Grip) => ReactNode }) {
  // Nothing moves until it's dropped: no transforms, only the line says where.
  const { attributes, listeners, setNodeRef } = useSortable({ id, disabled: !arranging })
  return (
    <div ref={setNodeRef} className={cn(dragging && 'opacity-35')} data-group-id={id}>
      {renderSection(id, arranging ? { attributes: attributes as unknown as Record<string, unknown>, listeners } : null)}
    </div>
  )
}
