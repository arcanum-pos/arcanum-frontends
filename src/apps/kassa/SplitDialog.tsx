import { useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatEuro } from '@/shared/format'
import { MAX_SPLIT_PARTS, splitPreviewText } from './lib'

const QUICK_PARTS = [2, 3, 4, 5, 6]

// "Splitsen": pay what's open in several payments, each with its own
// method and fooi. Gelijk verdelen divides it into N equal parts; Per item
// lets each person pay what they had (chosen on the ticket itself).
export function SplitDialog({
  open,
  openCents,
  onConfirm,
  onItems,
  onClose,
}: {
  open: boolean
  // What's open on the rekening (draft included) — what gets divided.
  openCents: number
  onConfirm: (parts: number) => void
  onItems: () => void
  onClose: () => void
}) {
  // Fresh state per opening — the caller remounts this via `key`.
  const [mode, setMode] = useState<'equal' | 'items'>('equal')
  const [parts, setParts] = useState(2)
  const max = Math.min(MAX_SPLIT_PARTS, Math.max(2, openCents))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'equal') onConfirm(parts)
            else onItems()
          }}
        >
          <DialogHeader>
            <DialogTitle>Splitsen</DialogTitle>
            <DialogDescription>{formatEuro(openCents)} in meerdere betalingen. Elke betaling kiest haar eigen betaalmethode en fooi.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Hoe splitsen">
            {(
              [
                ['equal', 'Gelijk verdelen'],
                ['items', 'Per item'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn('h-9 rounded-lg text-sm font-medium transition-colors', mode === key ? 'bg-card shadow-sm' : 'text-foreground/70 hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'items' && (
            <p className="text-sm text-foreground/80">
              Tik op de rekening aan wat de eerste persoon betaalt, en reken af. Betaalde stuks blijven gemarkeerd; kies daarna voor de volgende persoon. <strong>Alles wat open is</strong> selecteert de rest.
            </p>
          )}

          {mode === 'equal' && (
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
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Terug
            </Button>
            <Button type="submit">{mode === 'equal' ? `In ${parts} verdelen` : 'Items kiezen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
