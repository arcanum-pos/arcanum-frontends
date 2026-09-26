import { useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatEuro } from '@/shared/format'
import { MAX_SPLIT_PARTS, splitPreviewText } from './lib'

const QUICK_PARTS = [2, 3, 4, 5, 6]

// "Splitsen": pay what's open in several payments. Gelijk verdelen divides
// it into N equal parts — each paid on its own, with its own method and
// fooi. (Per item follows in a next step.)
export function SplitDialog({
  open,
  openCents,
  onConfirm,
  onClose,
}: {
  open: boolean
  // What's open on the rekening (draft included) — what gets divided.
  openCents: number
  onConfirm: (parts: number) => void
  onClose: () => void
}) {
  // Fresh state per opening — the caller remounts this via `key`.
  const [parts, setParts] = useState(2)
  const max = Math.min(MAX_SPLIT_PARTS, Math.max(2, openCents))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm(parts)
          }}
        >
          <DialogHeader>
            <DialogTitle>Splitsen</DialogTitle>
            <DialogDescription>Gelijk verdelen: {formatEuro(openCents)} over meerdere betalingen. Elke betaling kiest haar eigen betaalmethode en fooi.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase" id="split-parts-label">
              Aantal personen
            </p>
            <div className="flex items-center gap-3" role="group" aria-labelledby="split-parts-label">
              <button
                type="button"
                aria-label="Minder personen"
                disabled={parts <= 2}
                onClick={() => setParts(parts - 1)}
                className="flex size-12 items-center justify-center rounded-xl border text-xl hover:bg-muted disabled:opacity-40"
              >
                −
              </button>
              <output className="w-16 text-center font-mono text-4xl font-semibold tabular-nums" aria-live="polite" data-testid="split-parts">
                {parts}
              </output>
              <button
                type="button"
                aria-label="Meer personen"
                disabled={parts >= max}
                onClick={() => setParts(parts + 1)}
                className="flex size-12 items-center justify-center rounded-xl border text-xl hover:bg-muted disabled:opacity-40"
              >
                +
              </button>
            </div>
            <div className="flex gap-1.5">
              {QUICK_PARTS.filter((n) => n <= max).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={parts === n}
                  onClick={() => setParts(n)}
                  className={cn(
                    'h-9 min-w-10 rounded-lg border px-3 font-mono text-sm font-medium',
                    parts === n ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="font-mono text-sm tabular-nums" data-testid="split-preview">
              {splitPreviewText(openCents, parts)}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Terug
            </Button>
            <Button type="submit">In {parts} verdelen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
