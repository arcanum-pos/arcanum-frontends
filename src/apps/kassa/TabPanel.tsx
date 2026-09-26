import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/shared/format'
import { centsToInput, clampTip, draftTotalCents, FOOI_CODE, PAYMENT_METHOD_OPTIONS, readAmountCents, roundUpTipCents, type PaymentMethod } from './lib'
import { netQuantity, type DraftLine, type TabDetail, type TabLine } from './tabs-api'

// Right half of the kassa: the active tab (or the Toog quick-sale draft
// when `tab` is null) as a ticket, then how it's paid, then what else can
// be done with it. Styled after design_files/ (Kassa + CFD voorstel).
//
// Submitted lines are read-only — the only correction is a void with a
// reason. Draft lines (not yet sent) can still be freely changed.
//
// Fooi is entered here, at payment time: it's added to the charged amount
// (tipCents) but isn't a line on the tab, so it stays out of revenue.
export function TabPanel({
  title,
  subtitle,
  tab,
  draft,
  paymentMethod,
  tipInput,
  busy,
  onPaymentMethodChange,
  onTipInputChange,
  onDraftQuantity,
  onClearDraft,
  onVoid,
  onSubmitOrder,
  onPay,
  onPark,
  onRename,
  onCancelTab,
  onRefresh,
  onSplit,
  onStopSplit,
}: {
  title: string
  subtitle: string
  tab: TabDetail | null
  draft: DraftLine[]
  paymentMethod: PaymentMethod
  tipInput: string
  busy: boolean
  onPaymentMethodChange: (method: PaymentMethod) => void
  onTipInputChange: (value: string) => void
  onDraftQuantity: (index: number, quantity: number) => void
  onClearDraft: () => void
  onVoid: (line: TabLine) => void
  onSubmitOrder: () => void
  onPay: () => void
  onPark: () => void
  onRename: () => void
  onCancelTab: () => void
  onRefresh: () => void
  // "Splitsen": pay what's open in equal parts (opens the dialog).
  onSplit: () => void
  onStopSplit: () => void
}) {
  const submitted = (tab?.lines || []).filter((l) => !l.voidsLineId)
  const draftTotal = draftTotalCents(draft)
  const toPay = (tab?.outstandingCents || 0) + draftTotal
  // Split into equal parts: this payment is the next part — what's open ÷
  // parts left, the last one takes the rest (as the server computes it).
  const split = tab?.split ?? null
  const partsLeft = split ? Math.max(1, split.parts - split.paid) : 1
  const payCents = split && partsLeft > 1 ? Math.floor(toPay / partsLeft) : toPay
  const tipCents = payCents > 0 ? clampTip(readAmountCents(tipInput)) : 0
  const locked = busy || !!tab?.paymentPending
  const noTip = locked || payCents < 1
  const paidCents = tab?.paidCents || 0

  return (
    <div className="flex flex-col gap-3" data-testid="tab-panel">
      {/* The ticket */}
      <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{subtitle}</p>
          </div>
          {tab && (
            <Button variant="outline" size="sm" disabled={locked} onClick={onRename}>
              Naam wijzigen
            </Button>
          )}
        </div>

        {split && (
          <div className="flex items-center gap-3 border-b bg-muted/40 px-3.5 py-2.5" data-testid="split-banner">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-tight">
                Gesplitst in {split.parts} · deel {Math.min(split.paid + 1, split.parts)} van {split.parts}
              </p>
              <div className="mt-1.5 flex gap-1" aria-hidden="true">
                {Array.from({ length: split.parts }, (_, i) => (
                  <span key={i} className={cn('h-1.5 w-5 rounded-full', i < split.paid ? 'bg-foreground' : 'bg-foreground/15')} />
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={locked} onClick={onStopSplit}>
              Splitsen stoppen
            </Button>
          </div>
        )}

        {tab?.paymentPending && (
          <div className="flex flex-col gap-2 border-b bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p>Er loopt een betaling voor deze rekening. Wacht tot die afgerond of verlopen is.</p>
            <Button variant="outline" size="sm" className="self-start" onClick={onRefresh}>
              Vernieuwen
            </Button>
          </div>
        )}

        <div className="max-h-[340px] overflow-y-auto">
          {submitted.length === 0 && draft.length === 0 && (
            <p className="px-3.5 py-8 text-center text-[13px] text-muted-foreground">
              Nog niets aangeslagen.
              <br />
              Tik een product om te starten.
            </p>
          )}

          {submitted.map((line) => {
            const qty = netQuantity(line)
            return (
              <div key={line.id} className="flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2">
                <div className={cn('min-w-0 flex-1', qty === 0 && 'text-muted-foreground line-through')}>
                  <p className="truncate text-[13.5px] font-medium tracking-tight">{line.itemCode === FOOI_CODE ? 'Fooi' : `${qty || line.quantity} × ${line.name}`}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {line.voidedQuantity > 0 && qty > 0 ? `${line.voidedQuantity} geannuleerd` : formatEuro(line.unitPriceCents)}
                  </p>
                </div>
                {qty > 0 && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={locked} onClick={() => onVoid(line)}>
                    Annuleren
                  </Button>
                )}
                <span className="w-[72px] text-right font-mono text-[13.5px] font-semibold tabular-nums">{formatEuro(qty * line.unitPriceCents)}</span>
              </div>
            )
          })}

          {draft.length > 0 && (
            <>
              <div className="flex items-center justify-between bg-muted/40 px-3.5 py-1.5">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{tab ? 'Nieuw — nog niet toegevoegd' : 'Bestelling'}</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="text-foreground/70 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={onClearDraft}
                >
                  Leegmaken
                </Button>
              </div>
              {draft.map((line, i) => (
                <div key={line.variantId} className="flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium tracking-tight">{line.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{formatEuro(line.unitPriceCents)}</p>
                  </div>
                  <div className="flex h-8 items-center overflow-hidden rounded-lg border">
                    <button
                      type="button"
                      aria-label={`minder ${line.name}`}
                      disabled={busy}
                      onClick={() => onDraftQuantity(i, line.quantity - 1)}
                      className="flex size-[30px] items-center justify-center text-[15px] text-foreground/70 hover:bg-muted disabled:opacity-50"
                    >
                      −
                    </button>
                    <span className="w-[30px] text-center font-mono text-[13px] font-semibold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`meer ${line.name}`}
                      disabled={busy}
                      onClick={() => onDraftQuantity(i, line.quantity + 1)}
                      className="flex size-[30px] items-center justify-center text-[15px] text-foreground/70 hover:bg-muted disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-[72px] text-right font-mono text-[13.5px] font-semibold tabular-nums">{formatEuro(line.unitPriceCents * line.quantity)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {paidCents > 0 && (
          <div className="flex items-baseline justify-between border-t px-3.5 py-2 text-[13px] text-muted-foreground">
            <span>Al betaald</span>
            <span className="font-mono tabular-nums">− {formatEuro(paidCents)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t bg-muted/40 px-3.5 py-3">
          <span className="text-[13px] text-foreground/70">{paidCents > 0 ? 'Nog te betalen' : 'Te betalen'}</span>
          <span className="font-mono text-[30px] leading-tight font-semibold tracking-tight tabular-nums">{formatEuro(toPay)}</span>
        </div>
      </section>

      {/* How it's paid */}
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-3.5">
        <div>
          <p className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">Betaalmethode</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              // A real radio underneath (keyboard, screen readers), styled as a tile.
              <label
                key={opt.value}
                className={cn(
                  'relative flex h-[42px] cursor-pointer items-center justify-center rounded-lg border text-[13.5px] font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                  paymentMethod === opt.value ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground/80 hover:bg-muted'
                )}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={opt.value}
                  checked={paymentMethod === opt.value}
                  onChange={() => onPaymentMethodChange(opt.value)}
                  autoComplete="off"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tip-input" className="text-[12.5px] text-foreground/70">
              Fooi
            </label>
            <input
              id="tip-input"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={tipInput}
              disabled={noTip}
              onChange={(e) => onTipInputChange(e.target.value)}
              className="h-9 w-28 rounded-lg border bg-card px-3 text-right font-mono text-[13.5px] font-semibold tabular-nums outline-none focus-visible:border-foreground disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <TipButton disabled={noTip} onClick={() => onTipInputChange(centsToInput(clampTip(tipCents + 100)))}>
              +€1
            </TipButton>
            <TipButton disabled={noTip} onClick={() => onTipInputChange(centsToInput(clampTip(tipCents + 200)))}>
              +€2
            </TipButton>
            <TipButton disabled={noTip || roundUpTipCents(payCents) === 0} onClick={() => onTipInputChange(centsToInput(roundUpTipCents(payCents)))}>
              Afronden
            </TipButton>
            <TipButton disabled={locked || tipCents === 0} onClick={() => onTipInputChange('')}>
              Geen fooi
            </TipButton>
          </div>
        </div>
      </section>

      {/* What to do with it */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={locked || payCents < 1}
          onClick={onPay}
          className="h-[52px] rounded-xl bg-foreground text-[15px] font-semibold tracking-tight text-background transition-colors outline-none hover:bg-foreground/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {split
            ? `Afrekenen deel ${Math.min(split.paid + 1, split.parts)}/${split.parts} · ${formatEuro(payCents + tipCents)}`
            : `Afrekenen${payCents > 0 ? ` ${formatEuro(payCents + tipCents)}` : ''}`}
        </button>
        {tipCents > 0 && <p className="text-center text-[12.5px] text-muted-foreground">waarvan {formatEuro(tipCents)} fooi</p>}
        <div className="flex gap-2">
          {!split && toPay >= 2 && (
            <SecondaryButton disabled={locked} onClick={onSplit}>
              Splitsen
            </SecondaryButton>
          )}
          {tab && draft.length > 0 && (
            <SecondaryButton disabled={locked} onClick={onSubmitOrder}>
              Bestelling toevoegen aan rekening
            </SecondaryButton>
          )}
          {!tab && (
            <SecondaryButton disabled={busy || draft.length === 0} onClick={onPark}>
              Op rekening zetten
            </SecondaryButton>
          )}
          {tab && tab.totalCents === 0 && tab.paidCents === 0 && draft.length === 0 && (
            <SecondaryButton disabled={locked} onClick={onCancelTab}>
              Lege rekening sluiten
            </SecondaryButton>
          )}
        </div>
      </div>
    </div>
  )
}

function TipButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-lg border bg-card font-mono text-[12.5px] font-medium transition-colors outline-none hover:border-foreground hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function SecondaryButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[38px] flex-1 rounded-lg border bg-card px-3 text-[12.5px] font-medium text-foreground/80 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
