import { useState, type ReactNode } from 'react'
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { moveSection } from './layout'

// The menu's groups in this till's own columns (layout.ts). While arranging
// (Indeling aanpassen), each group is dragged by its grip — a finger, a mouse,
// or the keyboard (space, the arrows, space) — to another place in its column
// or into another one; otherwise nothing moves and the products are tapped as
// always. `renderSection` draws a group, `grip` the handle to put in its header.
export type Grip = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined } | null

const COLUMN = 'col:'

export function GroupColumns({
  columns,
  arranging,
  onChange,
  renderSection,
}: {
  columns: string[][]
  arranging: boolean
  onChange: (columns: string[][]) => void
  renderSection: (id: string, grip: Grip) => ReactNode
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [dragging, setDragging] = useState<string | null>(null)
  const columnOf = (id: string) => (id.startsWith(COLUMN) ? Number(id.slice(COLUMN.length)) : columns.findIndex((c) => c.includes(id)))

  // Moved once, where it's dropped: in place of the group it's over (that
  // one makes room), or at the end of the column when over the column itself.
  // While dragging, only the target column lights up — nothing jumps between columns.
  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    if (!over || over.id === active.id) return
    const to = columnOf(String(over.id))
    if (to < 0) return
    const overId = String(over.id)
    const next = moveSection(columns, String(active.id), to, overId.startsWith(COLUMN) ? columns[to].length : columns[to].indexOf(overId))
    if (JSON.stringify(next) !== JSON.stringify(columns)) onChange(next)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setDragging(String(active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid items-start gap-3 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': columns.length } as React.CSSProperties} data-testid="group-columns">
        {columns.map((ids, i) => (
          <Column key={i} index={i} arranging={arranging}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {ids.map((id) => (
                <SortableGroup key={id} id={id} arranging={arranging} dragging={dragging === id} renderSection={renderSection} />
              ))}
            </SortableContext>
          </Column>
        ))}
      </div>
    </DndContext>
  )
}

function Column({ index, arranging, children }: { index: number; arranging: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN}${index}`, disabled: !arranging })
  return (
    <div
      ref={setNodeRef}
      data-testid="group-column"
      className={cn('flex min-w-0 flex-col gap-3', arranging && 'min-h-32 rounded-xl border-2 border-dashed border-foreground/15 p-1.5', isOver && 'border-foreground/40 bg-muted/40')}
    >
      {children}
    </div>
  )
}

function SortableGroup({ id, arranging, dragging, renderSection }: { id: string; arranging: boolean; dragging: boolean; renderSection: (id: string, grip: Grip) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !arranging })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(dragging && 'relative z-10 opacity-80 shadow-lg')} data-group-id={id}>
      {renderSection(id, arranging ? { attributes: attributes as unknown as Record<string, unknown>, listeners } : null)}
    </div>
  )
}
