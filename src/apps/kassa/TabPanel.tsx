import { Check, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import {
  centsToInput,
  clampTip,
  draftTotalCents,
  FOOI_CODE,
  mergeTabLines,
  paymentMethodsFor,
  payableUnits,
  readAmountCents,
  roundUpTipCents,
  selectionCents,
  spreadUnits,
  type ItemSelection,
  type PaymentMethod,
} from './lib'
import { KASSA_MESSAGES } from './messages'
import { netQuantity, type DraftLine, type TabDetail, type TabLine } from './tabs-api'

// Right half of the kassa: the active tab (or the Toog quick-sale draft
// when `tab` is null) as a ticket, then how it's paid, then what else can
// be done with it. Styled after design_files/ (Kassa + CFD voorstel).
//
// Submitted lines are read-only — the only correction is a void with a
// reason. Draft lines (the round being tapped, not yet sent) come first,
// marked new, and can still be freely changed; on an open tab the kassa
// sends them by itself (App.tsx commitDraft) — there's no add button.
//
// Fooi is entered here, at payment time: it's added to the charged amount
// (tipCents) but isn't a line on the tab, so it stays out of revenue.
export function TabPanel({
  title,
  subtitle,
  tab,
  draft,
  paymentMethod,
  tapToPay = false,
  tipInput,
  busy,
  onPaymentMethodChange,
  onTipInputChange,
  onDraftQuantity,
  onClearDraft,
  onVoid,
  onPay,
  onPark,
  onRename,
  onCancelTab,
  onCancelTicket,
  onRefresh,
  onSplit,
  onStopSplit,
  itemSelection,
  onItemSelection,
  onStopItems,
  tipButtons = true,
}: {
  title: string
  subtitle: string
  tab: TabDetail | null
  draft: DraftLine[]
  paymentMethod: PaymentMethod
  // Tap to Pay is set up for the org: a fourth method.
  tapToPay?: boolean
  tipInput: string
  busy: boolean
  onPaymentMethodChange: (method: PaymentMethod) => void
  onTipInputChange: (value: string) => void
  onDraftQuantity: (variantId: string, quantity: number) => void
  onClearDraft: () => void
  onVoid: (line: TabLine) => void
  onPay: () => void
  onPark: () => void
  onRename: () => void
  onCancelTab: () => void
  onCancelTicket: () => void
  onRefresh: () => void
  // "Splitsen": pay what's open in equal parts (opens the dialog).
  onSplit: () => void
  onStopSplit: () => void
  // Split per item in progress: the units picked for this payment (null = not in that mode).
  itemSelection: ItemSelection | null
  onItemSelection: (selection: ItemSelection) => void
  onStopItems: () => void
  // The quick tip buttons (Aanpassen); the amount field stays.
  tipButtons?: boolean
}) {
  const m = useMessages(KASSA_MESSAGES)
  const submitted = (tab?.lines || []).filter((l) => !l.voidsLineId)
  // The same item from several rounds: one row (lib.ts mergeTabLines).
  const rows = mergeTabLines(submitted)
  const draftTotal = draftTotalCents(draft)
  const toPay = (tab?.outstandingCents || 0) + draftTotal
  // Split into equal parts: this payment is the next part — what's open ÷
  // parts left, the last one takes the rest (as the server computes it).
  const split = tab?.split ?? null
  const partsLeft = split ? Math.max(1, split.parts - split.paid) : 1
  const byItems = !!tab && itemSelection !== null
  const payCents = byItems ? selectionCents(tab!, itemSelection!) : split && partsLeft > 1 ? Math.floor(toPay / partsLeft) : toPay
  const tipCents = payCents > 0 ? clampTip(readAmountCents(tipInput)) : 0
  const locked = busy || !!tab?.paymentPending
  const noTip = locked || payCents < 1
  const paidCents = tab?.paidCents || 0

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.06)] ring-1 ring-foreground/5 lg:min-h-0 lg:flex-1 dark:ring-white/10"
      data-testid="tab-panel"
    >
      {/* The ticket */}
      <section className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 pt-3.5 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{tab ? m.onTheTab : m.draftQuick}</p>
            <h2 className="truncate text-[19px] font-bold tracking-tight">{title}</h2>
            <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{subtitle}</p>
            {tab?.contact && (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground" data-testid="tab-contact">
                {[tab.contact.phone, tab.contact.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {split && (
          <div className="flex shrink-0 items-center gap-3 border-b bg-muted/40 px-4 py-2.5" data-testid="split-banner">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-tight">
                {m.splitBanner(split.parts, Math.min(split.paid + 1, split.parts))}
              </p>
              <div className="mt-1.5 flex gap-1" aria-hidden="true">
                {Array.from({ length: split.parts }, (_, i) => (
                  <span key={i} className={cn('h-1.5 w-5 rounded-full', i < split.paid ? 'bg-foreground' : 'bg-foreground/15')} />
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={locked} onClick={onStopSplit}>
              {m.stopSplit}
            </Button>
          </div>
        )}

        {byItems && (
          <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-2.5" data-testid="items-banner">
            <p className="min-w-0 flex-1 text-[13px] font-semibold tracking-tight">{m.itemsBanner}</p>
            <Button variant="outline" size="sm" disabled={locked} onClick={() => onItemSelection(Object.fromEntries(tab!.lines.filter((l) => payableUnits(l) > 0).map((l) => [l.id, payableUnits(l)])))}>
              {m.allOpen}
            </Button>
            <Button variant="ghost" size="sm" disabled={locked} onClick={onStopItems}>
              {m.stop}
            </Button>
          </div>
        )}

        {tab?.paymentPending && (
          <div className="flex shrink-0 flex-col gap-2 border-b bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p>{m.paymentPending}</p>
            <Button variant="outline" size="sm" className="self-start" onClick={onRefresh}>
              {m.refresh}
            </Button>
          </div>
        )}

        {/* As high as the screen allows, with the payment and Afrekenen still in view. */}
        <div className="max-h-[max(9rem,calc(100svh-35rem))] overflow-y-auto lg:max-h-none lg:min-h-24 lg:flex-1">
          {submitted.length === 0 && draft.length === 0 && (
            <p className="px-3.5 py-8 text-center text-[13px] text-muted-foreground">
              {m.nothingYet}
              <br />
              {m.tapToStart}
            </p>
          )}

          {draft.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 bg-muted/60 px-3.5 py-1.5">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{tab ? m.draftOnTab : m.draftQuick}</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="text-foreground/70 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={onClearDraft}
                >
                  {m.clear}
                </Button>
              </div>
              {draft.map((line) => (
                <div key={line.variantId} className="flex items-center gap-2.5 border-b border-l-[3px] border-border/60 border-l-foreground bg-muted/30 py-2 pr-3.5 pl-[11px]" data-testid="draft-line">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[calc(15px*var(--kassa-text,1))] font-medium tracking-tight">{line.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{formatEuro(line.unitPriceCents)}</p>
                  </div>
                  <div className="flex h-8 items-center overflow-hidden rounded-lg border">
                    <button
                      type="button"
                      aria-label={m.less(line.name)}
                      disabled={busy}
                      onClick={() => onDraftQuantity(line.variantId, line.quantity - 1)}
                      className="flex size-[30px] items-center justify-center text-[15px] text-foreground/70 hover:bg-muted disabled:opacity-50"
                    >
                      −
                    </button>
                    <span className="w-[30px] text-center font-mono text-[13px] font-semibold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={m.more(line.name)}
                      disabled={busy}
                      onClick={() => onDraftQuantity(line.variantId, line.quantity + 1)}
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
          {byItems &&
            rows.map((line) => (
              <ItemRow
                key={line.id}
                line={line}
                selected={line.parts.reduce((n, part) => n + Math.min(itemSelection![part.id] || 0, payableUnits(part)), 0)}
                disabled={locked}
                onChange={(n) =>
                  onItemSelection({
                    ...itemSelection!,
                    ...Object.fromEntries(line.parts.map((part) => [part.id, 0])),
                    ...Object.fromEntries(spreadUnits(line.parts, n).map((x) => [x.line.id, x.quantity])),
                  })
                }
              />
            ))}

          {!byItems && rows.map((line) => {
            const qty = netQuantity(line)
            return (
              <div key={line.id} className="flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2">
                <div className={cn('min-w-0 flex-1', qty === 0 && 'text-muted-foreground line-through')}>
                  <p className="truncate text-[calc(15px*var(--kassa-text,1))] font-medium tracking-tight">{line.itemCode === FOOI_CODE ? m.tip : `${qty || line.quantity} × ${line.name}`}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {line.voidedQuantity > 0 && qty > 0 ? m.voided(line.voidedQuantity) : formatEuro(line.unitPriceCents)}
                    {(line.paidQuantity || 0) > 0 && ` · ${m.unitsPaid(line.paidQuantity || 0)}`}
                  </p>
                </div>
                {/* Paid units (per item) can't be cancelled — only offered while some aren't. */}
                {payableUnits(line) > 0 && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={locked} onClick={() => onVoid(line)}>
                    {m.voidLine}
                  </Button>
                )}
                <span className="w-[72px] text-right font-mono text-[13.5px] font-semibold tabular-nums">{formatEuro(qty * line.unitPriceCents)}</span>
              </div>
            )
          })}

        </div>

        {paidCents > 0 && (
          <div className="flex shrink-0 items-baseline justify-between border-t px-4 py-2 text-[13px] text-muted-foreground">
            <span>{m.alreadyPaid}</span>
            <span className="font-mono tabular-nums">− {formatEuro(paidCents)}</span>
          </div>
        )}
        <div className="flex shrink-0 items-baseline justify-between border-t px-4 py-3">
          <span className="text-[14.5px] font-semibold">{paidCents > 0 ? m.stillToPay : m.toPay}</span>
          <span className="font-mono text-[32px] leading-tight font-bold tracking-tight tabular-nums">{formatEuro(toPay)}</span>
        </div>
      </section>

      {/* How it's paid, and what else can be done with it */}
      <section className="flex shrink-0 flex-col gap-2.5 px-3.5 pb-3.5">
        {/* A real radio group underneath (keyboard, screen readers), shown as one segmented control. */}
        <div role="radiogroup" aria-label={m.paymentMethod} className="grid gap-[3px] rounded-xl bg-muted p-[3px]" style={{ gridTemplateColumns: `repeat(${paymentMethodsFor(tapToPay).length}, minmax(0, 1fr))` }}>
          {paymentMethodsFor(tapToPay).map((method) => (
            <label
              key={method}
              className={cn(
                'relative flex h-11 min-w-0 cursor-pointer items-center justify-center rounded-[9px] px-1 text-center text-[14px] leading-tight font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                paymentMethod === method ? 'bg-foreground text-background shadow-sm' : 'text-foreground/80 hover:bg-card/70'
              )}
            >
              <input
                type="radio"
                name="payment-method"
                value={method}
                checked={paymentMethod === method}
                onChange={() => onPaymentMethodChange(method)}
                autoComplete="off"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {m.methods[method]}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tip-input" className="text-[13.5px] text-muted-foreground">
              {m.tip}
            </label>
            <input
              id="tip-input"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={tipInput}
              disabled={noTip}
              onChange={(e) => onTipInputChange(e.target.value)}
              className="h-9 w-24 rounded-lg border bg-card px-3 text-right font-mono text-[13.5px] font-semibold tabular-nums outline-none focus-visible:border-foreground disabled:opacity-50"
            />
          </div>
          {tipButtons && (
            <div className="grid grid-cols-4 gap-1.5">
              <TipButton active={tipCents === 0} disabled={locked || tipCents === 0} onClick={() => onTipInputChange('')}>
                {m.noTip}
              </TipButton>
              <TipButton disabled={noTip} onClick={() => onTipInputChange(centsToInput(clampTip(tipCents + 100)))}>
                +€1
              </TipButton>
              <TipButton disabled={noTip} onClick={() => onTipInputChange(centsToInput(clampTip(tipCents + 200)))}>
                +€2
              </TipButton>
              <TipButton disabled={noTip || roundUpTipCents(payCents) === 0} onClick={() => onTipInputChange(centsToInput(roundUpTipCents(payCents)))}>
                {m.roundUp}
              </TipButton>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={locked || payCents < 1}
          onClick={onPay}
          className="min-h-14 rounded-[14px] bg-foreground px-3 py-2 text-[17px] leading-tight font-bold tracking-tight text-background transition-[background-color,transform] outline-none hover:bg-foreground/85 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:active:scale-100"
        >
          {byItems
            ? m.paySelection(payCents > 0 ? formatEuro(payCents + tipCents) : null)
            : split
            ? m.payPart(Math.min(split.paid + 1, split.parts), split.parts, formatEuro(payCents + tipCents))
            : m.pay(payCents > 0 ? formatEuro(payCents + tipCents) : null)}
        </button>
        {tipCents > 0 && <p className="-mt-1 text-center text-[12.5px] text-muted-foreground">{m.ofWhichTip(formatEuro(tipCents))}</p>}
        <Actions
          moreLabel={m.moreActions}
          actions={[
            !split && !byItems && toPay >= 2 && { label: m.split, disabled: locked, onSelect: onSplit },
            tab && { label: m.rename, disabled: locked, onSelect: onRename },
            !tab && { label: m.park, disabled: busy || draft.length === 0, onSelect: onPark },
            tab && tab.totalCents === 0 && tab.paidCents === 0 && draft.length === 0 && { label: m.closeEmpty, disabled: locked, onSelect: onCancelTab },
            // Something on it, nothing paid: the whole ticket at once (not while a payment runs).
            tab && tab.totalCents > 0 && tab.paidCents === 0 && !split && !byItems && { label: m.cancelTicket, disabled: locked, onSelect: onCancelTicket, destructive: true },
          ]}
        />
      </section>
    </div>
  )
}

type Action = { label: string; disabled: boolean; onSelect: () => void; destructive?: boolean }

// What else can be done with the ticket: the first two as buttons, the rest
// (and always what cancels something) under "…" - a calm ticket, nothing gone.
function Actions({ actions, moreLabel }: { actions: (Action | false | null | undefined | 0 | '')[]; moreLabel: string }) {
  const shown = actions.filter((a): a is Action => !!a)
  const buttons = shown.filter((a) => !a.destructive).slice(0, 2)
  const rest = shown.filter((a) => !buttons.includes(a))
  if (shown.length === 0) return null
  return (
    <div className="flex gap-2">
      {buttons.map((a) => (
        <SecondaryButton key={a.label} disabled={a.disabled} onClick={a.onSelect}>
          {a.label}
        </SecondaryButton>
      ))}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={moreLabel}
              title={moreLabel}
              className={cn(
                'flex min-h-11 items-center justify-center rounded-[11px] bg-muted px-3 text-foreground/80 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50',
                buttons.length === 0 && 'flex-1'
              )}
              data-testid="ticket-more"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((a) => (
              <DropdownMenuItem key={a.label} className="h-10" variant={a.destructive ? 'destructive' : 'default'} disabled={a.disabled} onSelect={a.onSelect}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function TipButton({ active = false, disabled, onClick, children }: { active?: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active || undefined}
      className={cn(
        'min-h-10 min-w-0 rounded-[9px] border px-1 py-1 text-[13px] leading-tight font-semibold [overflow-wrap:anywhere] transition-colors outline-none hover:border-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default',
        active ? 'border-foreground bg-foreground/[0.06]' : 'bg-card disabled:opacity-50'
      )}
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
      className="min-h-11 min-w-0 flex-1 rounded-[11px] bg-muted px-3 py-1.5 text-[14.5px] leading-tight font-semibold transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// One submitted line while paying per item: tap adds a unit to this
// payment (right-click takes one off, like the product buttons); a line
// with several units gets − n/m +. Paid units stay marked.
function ItemRow({ line, selected, disabled, onChange }: { line: TabLine; selected: number; disabled: boolean; onChange: (n: number) => void }) {
  const m = useMessages(KASSA_MESSAGES)
  const payable = payableUnits(line)
  const paid = line.paidQuantity || 0
  const qty = netQuantity(line)
  if (qty <= 0) return null
  const done = payable === 0
  return (
    <div
      className={cn('flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2', selected > 0 && 'bg-foreground/[0.04]', done && 'text-muted-foreground')}
      data-testid="item-row"
    >
      <button
        type="button"
        disabled={disabled || done}
        onClick={() => onChange(selected >= payable ? 0 : selected + 1)}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!disabled && selected > 0) onChange(selected - 1)
        }}
        aria-pressed={selected > 0}
        aria-label={m.picked(line.name, selected, payable)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none disabled:cursor-default"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold',
            done ? 'border-transparent bg-muted text-muted-foreground' : selected > 0 ? 'border-foreground bg-foreground text-background' : 'bg-card'
          )}
        >
          {(done || selected > 0) && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn('block truncate text-[13.5px] font-medium tracking-tight', done && 'line-through')}>
            {qty} × {line.name}
          </span>
          <span className="block font-mono text-[11px] text-muted-foreground">
            {formatEuro(line.unitPriceCents)}
            {paid > 0 && ` · ${m.unitsPaid(paid)}`}
          </span>
        </span>
      </button>
      {payable > 1 && (
        <div className="flex h-8 items-center overflow-hidden rounded-lg border">
          <button type="button" aria-label={m.less(line.name)} disabled={disabled || selected === 0} onClick={() => onChange(selected - 1)} className="flex size-[30px] items-center justify-center text-[15px] text-foreground/70 hover:bg-muted disabled:opacity-40">
            −
          </button>
          <span className="min-w-[38px] text-center font-mono text-[12.5px] font-semibold tabular-nums">
            {selected}/{payable}
          </span>
          <button type="button" aria-label={m.more(line.name)} disabled={disabled || selected >= payable} onClick={() => onChange(selected + 1)} className="flex size-[30px] items-center justify-center text-[15px] text-foreground/70 hover:bg-muted disabled:opacity-40">
            +
          </button>
        </div>
      )}
      <span className="w-[72px] text-right font-mono text-[13.5px] font-semibold tabular-nums">{selected > 0 ? formatEuro(selected * line.unitPriceCents) : ''}</span>
    </div>
  )
}
