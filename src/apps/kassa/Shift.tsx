import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatEuro } from '@/shared/format'
import { INTL_LOCALES, useLocale, useMessages, type Messages } from '@/shared/i18n'
import { addMovement, closeShift, countTotal, DENOMINATIONS, openShift, type Count, type RegisterState, type Shift } from '@/shared/register'
import { centsToInput, readAmountCents } from './lib'

// The kassa's side of registers and shifts (DOMAIN_MODEL.md "Registers,
// shifts and kasopmaak", release B2): "Kassa openen" with the opening float,
// cash movements during the shift, and the kasopmaak — the count against
// the expected cash (hidden until counted with blind count), totals per
// method, what stays in the drawer for the next shift.

const NOTE_THRESHOLD_CENTS = 100

const TEXTS: Messages<{
  openTitle: (register: string) => string
  openText: string
  float: string
  byDenomination: string
  byAmount: string
  openButton: string
  header: (register: string, number: number, since: string) => string
  movement: string
  cashUp: string
  movementTitle: string
  movementIn: string
  movementOut: string
  amount: string
  reason: string
  reasonPlaceholderIn: string
  reasonPlaceholderOut: string
  save: string
  cancel: string
  cashUpTitle: (register: string, number: number) => string
  pending: (n: number) => string
  openTabs: (n: number) => string
  count: string
  counted: string
  expected: string
  difference: string
  blindHint: string
  note: string
  noteRequired: string
  leftInDrawer: string
  leftHint: string
  methods: string
  methodNames: Record<string, string>
  movements: string
  floatLine: string
  close: string
  back: string
  doneTitle: string
  done: string
  total: string
}> = {
  nl: {
    openTitle: (r) => `Kassa openen — ${r}`,
    openText: 'Tel het wisselgeld in de lade. Pas daarna kan deze kassa verkopen.',
    float: 'Wisselgeld',
    byDenomination: 'Per biljet en munt tellen',
    byAmount: 'Eén bedrag ingeven',
    openButton: 'Kassa openen',
    header: (r, n, since) => `${r} · shift ${n} · open sinds ${since}`,
    movement: 'Kasbeweging',
    cashUp: 'Kasopmaak',
    movementTitle: 'Kasbeweging',
    movementIn: 'Erin (extra wisselgeld)',
    movementOut: 'Eruit (naar de kluis, een uitgave)',
    amount: 'Bedrag',
    reason: 'Reden',
    reasonPlaceholderIn: 'bv. Extra wisselgeld',
    reasonPlaceholderOut: 'bv. Naar de kluis, ijs gekocht',
    save: 'Opslaan',
    cancel: 'Annuleren',
    cashUpTitle: (r, n) => `Kasopmaak — ${r}, shift ${n}`,
    pending: (n) => (n === 1 ? 'Er loopt nog een betaling op deze kassa. Rond die eerst af.' : `Er lopen nog ${n} betalingen op deze kassa. Rond ze eerst af.`),
    openTabs: (n) => (n === 1 ? 'Er staat nog 1 rekening open. Ze loopt door in de volgende shift.' : `Er staan nog ${n} rekeningen open. Ze lopen door in de volgende shift.`),
    count: 'Tel alles wat in de lade zit',
    counted: 'Geteld',
    expected: 'Verwacht',
    difference: 'Verschil',
    blindHint: 'Het verwachte bedrag zie je na het afsluiten.',
    note: 'Opmerking',
    noteRequired: 'Er is een verschil: schrijf erbij wat er gebeurd is.',
    leftInDrawer: 'Blijft in de lade',
    leftHint: 'Het wisselgeld voor de volgende shift. De rest gaat eruit.',
    methods: 'Per betaalmethode',
    methodNames: { cash: 'Contant', sumup: 'SumUp', bancontact: 'Bancontact' },
    movements: 'Kasbewegingen',
    floatLine: 'Wisselgeld bij het openen',
    close: 'Kassa afsluiten',
    back: 'Terug',
    doneTitle: 'Kassa afgesloten',
    done: 'Klaar',
    total: 'Totaal',
  },
  fr: {
    openTitle: (r) => `Ouvrir la caisse — ${r}`,
    openText: 'Comptez la monnaie dans le tiroir. Ensuite seulement, cette caisse peut vendre.',
    float: 'Fond de caisse',
    byDenomination: 'Compter par billet et pièce',
    byAmount: 'Saisir un montant',
    openButton: 'Ouvrir la caisse',
    header: (r, n, since) => `${r} · service ${n} · ouvert depuis ${since}`,
    movement: 'Mouvement de caisse',
    cashUp: 'Clôture',
    movementTitle: 'Mouvement de caisse',
    movementIn: 'Entrée (monnaie en plus)',
    movementOut: 'Sortie (vers le coffre, une dépense)',
    amount: 'Montant',
    reason: 'Raison',
    reasonPlaceholderIn: 'p. ex. Monnaie en plus',
    reasonPlaceholderOut: 'p. ex. Vers le coffre, glace achetée',
    save: 'Enregistrer',
    cancel: 'Annuler',
    cashUpTitle: (r, n) => `Clôture — ${r}, service ${n}`,
    pending: (n) => (n === 1 ? 'Un paiement est encore en cours sur cette caisse. Terminez-le d’abord.' : `${n} paiements sont encore en cours sur cette caisse. Terminez-les d’abord.`),
    openTabs: (n) => (n === 1 ? '1 addition est encore ouverte. Elle continue au service suivant.' : `${n} additions sont encore ouvertes. Elles continuent au service suivant.`),
    count: 'Comptez tout ce qui est dans le tiroir',
    counted: 'Compté',
    expected: 'Attendu',
    difference: 'Écart',
    blindHint: 'Vous voyez le montant attendu après la clôture.',
    note: 'Remarque',
    noteRequired: 'Il y a un écart : expliquez ce qui s’est passé.',
    leftInDrawer: 'Reste dans le tiroir',
    leftHint: 'Le fond de caisse du service suivant. Le reste sort.',
    methods: 'Par moyen de paiement',
    methodNames: { cash: 'Espèces', sumup: 'SumUp', bancontact: 'Bancontact' },
    movements: 'Mouvements de caisse',
    floatLine: 'Fond de caisse à l’ouverture',
    close: 'Clôturer la caisse',
    back: 'Retour',
    doneTitle: 'Caisse clôturée',
    done: 'Terminé',
    total: 'Total',
  },
  en: {
    openTitle: (r) => `Open the till — ${r}`,
    openText: 'Count the change in the drawer. Only then can this till sell.',
    float: 'Opening float',
    byDenomination: 'Count per note and coin',
    byAmount: 'Enter one amount',
    openButton: 'Open the till',
    header: (r, n, since) => `${r} · shift ${n} · open since ${since}`,
    movement: 'Cash movement',
    cashUp: 'Cash-up',
    movementTitle: 'Cash movement',
    movementIn: 'In (extra change)',
    movementOut: 'Out (to the safe, an expense)',
    amount: 'Amount',
    reason: 'Reason',
    reasonPlaceholderIn: 'e.g. Extra change',
    reasonPlaceholderOut: 'e.g. To the safe, bought ice',
    save: 'Save',
    cancel: 'Cancel',
    cashUpTitle: (r, n) => `Cash-up — ${r}, shift ${n}`,
    pending: (n) => (n === 1 ? 'A payment on this till is still under way. Finish it first.' : `${n} payments on this till are still under way. Finish them first.`),
    openTabs: (n) => (n === 1 ? '1 tab is still open. It carries on in the next shift.' : `${n} tabs are still open. They carry on in the next shift.`),
    count: 'Count everything in the drawer',
    counted: 'Counted',
    expected: 'Expected',
    difference: 'Difference',
    blindHint: 'You see the expected amount after closing.',
    note: 'Note',
    noteRequired: 'There is a difference: write down what happened.',
    leftInDrawer: 'Stays in the drawer',
    leftHint: 'The float for the next shift. The rest goes out.',
    methods: 'Per payment method',
    methodNames: { cash: 'Cash', sumup: 'SumUp', bancontact: 'Bancontact' },
    movements: 'Cash movements',
    floatLine: 'Float at opening',
    close: 'Close the till',
    back: 'Back',
    doneTitle: 'Till closed',
    done: 'Done',
    total: 'Total',
  },
}

export const useShiftTexts = () => useMessages(TEXTS)

const denominationLabel = (cents: number) => (cents >= 100 ? `€ ${cents / 100}` : `${cents} ct`)

// A count per note and coin, with its total.
function CountGrid({ count, onChange }: { count: Count; onChange: (count: Count) => void }) {
  const t = useMessages(TEXTS)
  return (
    <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2" data-testid="count-grid">
      {DENOMINATIONS.map((d) => (
        <label key={d} className="flex items-center gap-2 text-sm">
          <span className="w-14 shrink-0 text-right font-mono tabular-nums">{denominationLabel(d)}</span>
          <span className="text-muted-foreground">×</span>
          <Input
            className="h-9 w-20 text-right font-mono"
            inputMode="numeric"
            aria-label={denominationLabel(d)}
            value={count[d] ? String(count[d]) : ''}
            onChange={(e) => onChange({ ...count, [d]: Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0 })}
          />
          <span className="ml-auto font-mono text-muted-foreground tabular-nums">{count[d] ? formatEuro(d * count[d]) : ''}</span>
        </label>
      ))}
      <div className="col-span-full flex justify-between border-t pt-2 font-semibold">
        <span>{t.total}</span>
        <span className="font-mono tabular-nums" data-testid="count-total">
          {formatEuro(countTotal(count))}
        </span>
      </div>
    </div>
  )
}

// "Kassa openen": the opening float, counted per note and coin or as one amount.
export function OpenRegister({ orgId, state, onOpened }: { orgId: string; state: RegisterState; onOpened: (shift: Shift) => void }) {
  const t = useMessages(TEXTS)
  const [byCount, setByCount] = useState(false)
  const [amount, setAmount] = useState(centsToInput(state.suggestedFloatCents ?? 0))
  const [count, setCount] = useState<Count>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    try {
      onOpened(await openShift(orgId, state.register.id, byCount ? { count } : { floatCents: readAmountCents(amount) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10" data-testid="open-register">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t.openTitle(state.register.name)}</h2>
        <p className="text-sm text-muted-foreground">{t.openText}</p>
      </div>
      <div className="flex gap-2">
        <Button variant={byCount ? 'outline' : 'default'} size="sm" onClick={() => setByCount(false)}>
          {t.byAmount}
        </Button>
        <Button variant={byCount ? 'default' : 'outline'} size="sm" onClick={() => setByCount(true)}>
          {t.byDenomination}
        </Button>
      </div>
      {byCount ? (
        <CountGrid count={count} onChange={setCount} />
      ) : (
        <div className="grid max-w-xs gap-2">
          <Label htmlFor="float">{t.float}</Label>
          <Input id="float" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button size="lg" className="w-fit" disabled={busy} onClick={open}>
        {t.openButton}
      </Button>
    </div>
  )
}

// "Kasbeweging": cash in or out, with an amount and a reason.
export function MovementDialog({ orgId, shift, deviceName, onClose, onSaved }: { orgId: string; shift: Shift; deviceName: string; onClose: () => void; onSaved: (shift: Shift) => void }) {
  const t = useMessages(TEXTS)
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved(await addMovement(orgId, shift.id, { direction, amountCents: readAmountCents(amount), reason: reason.trim(), deviceName }))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.movementTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={direction === 'in' ? 'default' : 'outline'} onClick={() => setDirection('in')}>
              <ArrowDownToLine /> {t.movementIn}
            </Button>
            <Button variant={direction === 'out' ? 'default' : 'outline'} onClick={() => setDirection('out')}>
              <ArrowUpFromLine /> {t.movementOut}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="movement-amount">{t.amount}</Label>
            <Input id="movement-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="movement-reason">{t.reason}</Label>
            <Input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={direction === 'in' ? t.reasonPlaceholderIn : t.reasonPlaceholderOut} maxLength={140} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button onClick={save} disabled={busy || !readAmountCents(amount) || !reason.trim()}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The kasopmaak: count, compare, explain, choose what stays, close.
export function CashUp({ orgId, state, onBack, onClosed }: { orgId: string; state: RegisterState & { shift: Shift }; onBack: () => void; onClosed: () => void }) {
  const t = useMessages(TEXTS)
  const { locale } = useLocale()
  const shift = state.shift
  const [count, setCount] = useState<Count>({})
  const [note, setNote] = useState('')
  const counted = countTotal(count)
  const [left, setLeft] = useState(centsToInput(shift.openingFloatCents))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Shift | null>(null)

  const blind = state.blindCount
  const expected = shift.expectedCents
  const difference = expected === null ? null : counted - expected
  const needsNote = !blind && difference !== null && Math.abs(difference) >= NOTE_THRESHOLD_CENTS
  const leftCents = readAmountCents(left)
  const methods = useMemo(() => Object.entries(shift.totals.methods), [shift.totals.methods])
  const time = (iso: string) => new Date(iso).toLocaleTimeString(INTL_LOCALES[locale], { hour: '2-digit', minute: '2-digit' })

  async function close() {
    setBusy(true)
    setError(null)
    try {
      setResult(await closeShift(orgId, shift.id, { count, note: note.trim() || undefined, leftInDrawerCents: leftCents }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const diff = result.differenceCents ?? 0
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10" data-testid="cash-up-done">
        <h2 className="text-xl font-semibold tracking-tight">{t.doneTitle}</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt>{t.expected}</dt>
          <dd className="text-right font-mono tabular-nums">{formatEuro(result.expectedCents ?? 0)}</dd>
          <dt>{t.counted}</dt>
          <dd className="text-right font-mono tabular-nums">{formatEuro(result.countedCents ?? 0)}</dd>
          <dt className="font-semibold">{t.difference}</dt>
          <dd className={cn('text-right font-mono font-semibold tabular-nums', diff < 0 ? 'text-destructive' : diff > 0 ? 'text-amber-600' : '')} data-testid="cash-up-difference">
            {formatEuro(diff)}
          </dd>
          <dt>{t.leftInDrawer}</dt>
          <dd className="text-right font-mono tabular-nums">{formatEuro(result.leftInDrawerCents ?? 0)}</dd>
        </dl>
        <Button className="w-fit" onClick={onClosed}>
          {t.done}
        </Button>
      </div>
    )
  }

  const pending = shift.pendingPayments ?? 0
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10" data-testid="cash-up">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t.cashUpTitle(state.register.name, shift.number)}</h2>
        <Button variant="ghost" onClick={onBack}>
          {t.back}
        </Button>
      </div>
      {pending > 0 && (
        <p className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert" data-testid="cash-up-pending">
          <AlertTriangle className="size-4 shrink-0" /> {t.pending(pending)}
        </p>
      )}
      {(shift.openTabs ?? 0) > 0 && (
        <p className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="cash-up-open-tabs">
          <AlertTriangle className="size-4 shrink-0" /> {t.openTabs(shift.openTabs!)}
        </p>
      )}

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t.count}</h3>
        <CountGrid count={count} onChange={setCount} />
      </section>

      <section className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <span>{t.counted}</span>
          <span className="font-mono tabular-nums">{formatEuro(counted)}</span>
        </div>
        {blind ? (
          <p className="text-muted-foreground">{t.blindHint}</p>
        ) : (
          <>
            <div className="flex justify-between">
              <span>{t.expected}</span>
              <span className="font-mono tabular-nums" data-testid="cash-up-expected">
                {formatEuro(expected ?? 0)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t.difference}</span>
              <span className={cn('font-mono tabular-nums', (difference ?? 0) < 0 ? 'text-destructive' : (difference ?? 0) > 0 ? 'text-amber-600' : '')} data-testid="cash-up-live-difference">
                {formatEuro(difference ?? 0)}
              </span>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-1 text-sm">
        <h3 className="font-semibold">{t.methods}</h3>
        <div className="flex justify-between text-muted-foreground">
          <span>{t.floatLine}</span>
          <span className="font-mono tabular-nums">{formatEuro(shift.openingFloatCents)}</span>
        </div>
        {methods.map(([method, x]) => (
          <div key={method} className="flex justify-between">
            <span>
              {t.methodNames[method] ?? method} · {x.count}×
            </span>
            <span className="font-mono tabular-nums">{formatEuro(x.cents)}</span>
          </div>
        ))}
        {shift.movements.length > 0 && <h3 className="mt-2 font-semibold">{t.movements}</h3>}
        {shift.movements.map((mv, i) => (
          <div key={i} className="flex justify-between text-muted-foreground">
            <span>
              {time(mv.at)} · {mv.reason}
            </span>
            <span className="font-mono tabular-nums">{formatEuro(mv.direction === 'in' ? mv.amountCents : -mv.amountCents)}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="cash-up-note">{t.note}</Label>
          <Input id="cash-up-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          {needsNote && !note.trim() && <p className="text-xs text-amber-700 dark:text-amber-300">{t.noteRequired}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cash-up-left">{t.leftInDrawer}</Label>
          <Input id="cash-up-left" inputMode="decimal" value={left} onChange={(e) => setLeft(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t.leftHint}</p>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button size="lg" className="w-fit" disabled={busy || pending > 0 || (needsNote && !note.trim()) || leftCents > counted} onClick={close}>
        {t.close}
      </Button>
    </div>
  )
}
