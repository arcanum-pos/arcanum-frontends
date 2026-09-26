import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { netQuantity, type TabLine } from './tabs-api'

// Open a new tab, park the Toog draft as one, or rename one — all just "a
// name". Free text for now; a table becomes a real record later
// (DOMAIN_MODEL.md: Floor / Table).
export function NameDialog({
  open,
  title,
  description,
  confirmLabel,
  initialValue = '',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  initialValue?: string
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  // Fresh state per opening — the caller remounts this via `key`.
  const [name, setName] = useState(initialValue)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm(name.trim())
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tab-name">Naam of tafel</Label>
            <Input id="tab-name" autoFocus placeholder="bv. Tafel 4, Jan" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Terug
            </Button>
            <Button type="submit">{confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const QUICK_REASONS = ['Verkeerd aangeslagen', 'Klant annuleert', 'Niet leverbaar']

// A submitted line is never edited or deleted — this records a void line
// with a reason (DOMAIN_MODEL.md append-only rule).
export function VoidDialog({
  line,
  onConfirm,
  onClose,
}: {
  line: TabLine | null
  onConfirm: (line: TabLine, reason: string, quantity: number) => void
  onClose: () => void
}) {
  // Not what's already paid per item: those units can't be cancelled.
  const remaining = line ? netQuantity(line) - (line.paidQuantity || 0) : 0
  // Fresh state per line — the caller remounts this via `key`.
  const [reason, setReason] = useState('')
  const [quantity, setQuantity] = useState(remaining)

  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= remaining

  return (
    <Dialog open={line !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {line && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (reason.trim() && validQuantity) onConfirm(line, reason.trim(), quantity)
            }}
          >
            <DialogHeader>
              <DialogTitle>Lijn annuleren</DialogTitle>
              <DialogDescription>
                {remaining} × {line.name} — de lijn blijft zichtbaar in de geschiedenis, met reden.
              </DialogDescription>
            </DialogHeader>
            {remaining > 1 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="void-qty">Aantal annuleren</Label>
                <Input
                  id="void-qty"
                  type="number"
                  min={1}
                  max={remaining}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.round(Number(e.target.value)))}
                  className="w-24"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="void-reason">Reden</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((r) => (
                  <Button key={r} type="button" size="sm" variant={reason === r ? 'default' : 'outline'} onClick={() => setReason(r)}>
                    {r}
                  </Button>
                ))}
              </div>
              <Input id="void-reason" placeholder="Of typ een reden" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Terug
              </Button>
              <Button type="submit" variant="destructive" disabled={!reason.trim() || !validQuantity}>
                Lijn annuleren
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
