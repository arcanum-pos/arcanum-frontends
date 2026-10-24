import { useRef } from 'react'
import { cn } from 'cn'

// The line between ordering and the tab (on the right, or on the left with
// `reversed`): dragged with a mouse or a finger to make the tab panel wider or
// narrower, or with the arrow keys once focused; a double-click (or Home) puts
// it back. The width is this till's (layout.ts), kept by the caller.
export function PanelDivider({
  width,
  min,
  max,
  label,
  onChange,
  onReset,
  reversed = false,
}: {
  width: number
  min: number
  max: number
  label: string
  onChange: (width: number) => void
  onReset: () => void
  reversed?: boolean
}) {
  // Towards the tab makes it narrower, away from it wider.
  const sign = reversed ? -1 : 1
  const drag = useRef<{ x: number; width: number } | null>(null)
  const set = (next: number) => onChange(Math.round(Math.min(max, Math.max(min, next))))
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-testid="panel-divider"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, width }
      }}
      // The panel is on the right: dragging the line left makes it wider.
      onPointerMove={(e) => drag.current && set(drag.current.width + sign * (drag.current.x - e.clientX))}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16
        if (e.key === 'ArrowLeft') set(width + sign * step)
        else if (e.key === 'ArrowRight') set(width - sign * step)
        else if (e.key === 'Home') onReset()
        else return
        e.preventDefault()
      }}
      className={cn(
        'group relative hidden w-5 shrink-0 cursor-col-resize touch-none self-stretch outline-none select-none lg:block',
        'focus-visible:[&>span]:bg-ring'
      )}
    >
      {/* The line, and a grip in the middle that says it can be dragged. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-foreground/15 transition-colors group-hover:bg-foreground/40" />
      <span
        aria-hidden="true"
        className="sticky top-[45vh] left-1/2 mx-auto mt-[40vh] flex h-10 w-3 -translate-x-[1px] flex-col items-center justify-center gap-1 rounded-full border bg-card shadow-sm transition-colors group-hover:border-foreground/40"
      >
        <i className="size-1 rounded-full bg-foreground/40" />
        <i className="size-1 rounded-full bg-foreground/40" />
        <i className="size-1 rounded-full bg-foreground/40" />
      </span>
    </div>
  )
}
