import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMessages } from '@/shared/i18n'
import { KASSA_MESSAGES } from './messages'
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
  const m = useMessages(KASSA_MESSAGES)
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
            <Label htmlFor="tab-name">{m.nameLabel}</Label>
            <Input id="tab-name" autoFocus placeholder={m.namePlaceholder} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="h-11 px-5 text-[15px]" type="button" variant="outline" onClick={onClose}>
              {m.back}
            </Button>
            <Button className="h-11 px-5 text-[15px]" type="submit">{confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
  const m = useMessages(KASSA_MESSAGES)
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
              <DialogTitle>{m.voidTitle}</DialogTitle>
              <DialogDescription>{m.voidDescription(remaining, line.name)}</DialogDescription>
            </DialogHeader>
            {remaining > 1 && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="void-qty">{m.voidQuantity}</Label>
                {/* − n +: a finger at the bar, the number still typed when easier. */}
                <div className="flex items-center rounded-[10px] bg-muted">
                  <button type="button" aria-label={m.less(line.name)} disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex size-11 items-center justify-center text-[20px] disabled:opacity-40">
                    −
                  </button>
                  <Input
                    id="void-qty"
                    type="number"
                    min={1}
                    max={remaining}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.round(Number(e.target.value)))}
                    className="h-11 w-14 [appearance:textfield] border-0 bg-transparent px-0 text-center text-[16px] font-bold shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button type="button" aria-label={m.more(line.name)} disabled={quantity >= remaining} onClick={() => setQuantity(Math.min(remaining, quantity + 1))} className="flex size-11 items-center justify-center text-[20px] disabled:opacity-40">
                    +
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="void-reason">{m.reason}</Label>
              <div className="flex flex-wrap gap-2">
                {m.quickReasons.map((r) => (
                  <Button key={r} type="button" className="h-10 px-3.5 text-[14px]" variant={reason === r ? 'default' : 'outline'} onClick={() => setReason(r)}>
                    {r}
                  </Button>
                ))}
              </div>
              <Input id="void-reason" placeholder={m.reasonPlaceholder} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button className="h-11 px-5 text-[15px]" type="button" variant="outline" onClick={onClose}>
                {m.back}
              </Button>
              <Button className="h-11 px-5 text-[15px]" type="submit" variant="destructive" disabled={!reason.trim() || !validQuantity}>
                {m.voidTitle}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// "Ticket annuleren": the whole ticket at once (an accidental Afrekenen,
// a customer who leaves) — one reason, every line voided with it, the ticket
// closed as cancelled. Append-only like a single void: nothing is deleted.
export function CancelTicketDialog({
  open,
  items,
  amount,
  onConfirm,
  onClose,
}: {
  open: boolean
  items: number
  amount: string
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const m = useMessages(KASSA_MESSAGES)
  const [reason, setReason] = useState('')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (reason.trim()) onConfirm(reason.trim())
          }}
          data-testid="cancel-ticket"
        >
          <DialogHeader>
            <DialogTitle>{m.cancelTicket}</DialogTitle>
            <DialogDescription>{m.cancelTicketDescription(items, amount)}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-reason">{m.reason}</Label>
            <div className="flex flex-wrap gap-2">
              {m.quickReasons.map((r) => (
                <Button key={r} type="button" className="h-10 px-3.5 text-[14px]" variant={reason === r ? 'default' : 'outline'} onClick={() => setReason(r)}>
                  {r}
                </Button>
              ))}
            </div>
            <Input id="cancel-reason" placeholder={m.reasonPlaceholder} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="h-11 px-5 text-[15px]" type="button" variant="outline" onClick={onClose}>
              {m.back}
            </Button>
            <Button className="h-11 px-5 text-[15px]" type="submit" variant="destructive" disabled={!reason.trim()}>
              {m.cancelTicket}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
