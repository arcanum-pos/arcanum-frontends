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
import { moveSection } from './layout'

// The menu's groups in this till's own columns (layout.ts). While arranging
// (Indeling aanpassen), each group is dragged by its grip — a finger, a mouse,
// or the keyboard (space, the arrows, space). What's dragged follows the
// pointer as a card; where it will land is always shown: its column lit up
// and a line at the place — above or below the group under the pointer, or at
// the bottom of the column. The whole height of a column takes it, and a drop
// in a gap goes to the nearest column — never back by surprise. Nothing moves
// until it's dropped. Otherwise nothing moves at all and the products are
// tapped as always. `renderSection` draws a group, `grip` the handle to put
// in its header. Above the columns, a row over the whole width (`top`) takes
// groups the same way (list 0 here; the columns are 1…).
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

export function GroupColumns({
  top,
  columns: columnLists,
  arranging,
  onChange,
  renderSection,
  nameOf,
  dropHere,
  fullWidth,
}: {
  top: string[]
  columns: string[][]
  arranging: boolean
  onChange: (top: string[], columns: string[][]) => void
  renderSection: (id: string, grip: Grip) => ReactNode
  nameOf: (id: string) => string
  // "Hier neerzetten": said in the column it will land in.
  dropHere: string
  // "Over de hele breedte": the empty full-width row while arranging.
  fullWidth: string
}) {
  const columns = [top, ...columnLists]
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
    if (JSON.stringify(next) !== JSON.stringify(columns)) onChange(next[0], next.slice(1))
  }

  function list(i: number, wide: boolean) {
    const ids = columns[i]
    // The place it would land, counted without the dragged group itself.
    const shown = ids.filter((id) => id !== dragging)
    const line = target?.column === i ? target.index : -1
    return (
      <Column key={i} index={i} arranging={arranging} active={target?.column === i} label={dropHere} wide={wide} emptyLabel={wide && ids.length === 0 ? fullWidth : null}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => (
            <div key={id} className="flex flex-col gap-3">
              {dragging !== id && line === shown.indexOf(id) && <DropLine />}
              <SortableGroup id={id} arranging={arranging} dragging={dragging === id} renderSection={renderSection} />
            </div>
          ))}
          {line === shown.length && <DropLine />}
        </SortableContext>
      </Column>
    )
  }

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
      {(arranging || top.length > 0) && list(0, true)}
      <div className="grid items-stretch gap-3 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': columnLists.length } as React.CSSProperties} data-testid="group-columns">
        {columnLists.map((_, i) => list(i + 1, false))}
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

function Column({ index, arranging, active, label, wide, emptyLabel, children }: { index: number; arranging: boolean; active: boolean; label: string; wide: boolean; emptyLabel: string | null; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN}${index}`, disabled: !arranging })
  return (
    <div
      ref={setNodeRef}
      data-testid={wide ? 'group-row' : 'group-column'}
      data-target={active || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-3',
        arranging && 'rounded-xl border-2 border-dashed border-foreground/15 p-1.5 transition-colors',
        arranging && (wide ? 'min-h-16' : 'min-h-40'),
        active && 'border-solid border-foreground bg-foreground/[0.04]'
      )}
    >
      {emptyLabel && !active && <p className="my-auto py-2 text-center text-[12px] font-medium text-foreground/50">{emptyLabel}</p>}
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
