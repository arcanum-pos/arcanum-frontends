import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEuro } from '@/shared/format'
import { draftTotalCents, FOOI_CODE, PAYMENT_METHOD_OPTIONS, type PaymentMethod } from './lib'
import { netQuantity, type DraftLine, type TabDetail, type TabLine } from './tabs-api'

// Right half of the kassa: the active tab (or the Toog quick-sale draft
// when `tab` is null). Only ever deals in generic lines, so it survives the
// hardcoded picker being replaced by the catalog (step 3).
//
// Submitted lines are read-only — the only correction is a void with a
// reason. Draft lines (not yet sent) can still be freely changed.
export function TabPanel({
  title,
  tab,
  draft,
  paymentMethod,
  busy,
  onPaymentMethodChange,
  onDraftQuantity,
  onClearDraft,
  onVoid,
  onSubmitOrder,
  onPay,
  onPark,
  onRename,
  onCancelTab,
  onRefresh,
}: {
  title: string
  tab: TabDetail | null
  draft: DraftLine[]
  paymentMethod: PaymentMethod
  busy: boolean
  onPaymentMethodChange: (method: PaymentMethod) => void
  onDraftQuantity: (index: number, quantity: number) => void
  onClearDraft: () => void
  onVoid: (line: TabLine) => void
  onSubmitOrder: () => void
  onPay: () => void
  onPark: () => void
  onRename: () => void
  onCancelTab: () => void
  onRefresh: () => void
}) {
  const submitted = (tab?.lines || []).filter((l) => !l.voidsLineId)
  const draftTotal = draftTotalCents(draft)
  const toPay = (tab?.outstandingCents || 0) + draftTotal
  const locked = busy || !!tab?.paymentPending

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {tab && (
          <Button variant="ghost" size="sm" disabled={locked} onClick={onRename}>
            Naam wijzigen
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tab?.paymentPending && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
            <p>Er loopt een betaling voor deze rekening. Wacht tot die afgerond of verlopen is.</p>
            <Button variant="outline" size="sm" className="self-start" onClick={onRefresh}>
              Vernieuwen
            </Button>
          </div>
        )}

        {submitted.length === 0 && draft.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nog niets aangeslagen. Tik een product om te starten.</p>
        )}

        {submitted.length > 0 && (
          <div className="flex flex-col">
            {submitted.map((line) => {
              const qty = netQuantity(line)
              return (
                <div key={line.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                  <div className={qty === 0 ? 'text-muted-foreground line-through' : ''}>
                    <p className="font-medium">{line.itemCode === FOOI_CODE ? 'Fooi' : `${qty || line.quantity} × ${line.name}`}</p>
                    {line.voidedQuantity > 0 && qty > 0 && <p className="text-xs text-muted-foreground">{line.voidedQuantity} geannuleerd</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{formatEuro(qty * line.unitPriceCents)}</span>
                    {qty > 0 && (
                      <Button variant="ghost" size="sm" disabled={locked} onClick={() => onVoid(line)}>
                        Annuleren
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {draft.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{tab ? 'Nieuw — nog niet toegevoegd' : 'Bestelling'}</p>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onClearDraft}>
                Leegmaken
              </Button>
            </div>
            {draft.map((line, i) => (
              <div key={`${line.itemCode}-${i}`} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                <div>
                  <p className="font-medium">{line.itemCode === FOOI_CODE ? 'Fooi' : line.name}</p>
                  {line.itemCode !== FOOI_CODE && <p className="text-xs text-muted-foreground">{formatEuro(line.unitPriceCents)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {line.itemCode !== FOOI_CODE ? (
                    <>
                      <Button variant="outline" size="icon-sm" aria-label={`minder ${line.name}`} disabled={busy} onClick={() => onDraftQuantity(i, line.quantity - 1)}>
                        −
                      </Button>
                      <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                      <Button variant="outline" size="icon-sm" aria-label={`meer ${line.name}`} disabled={busy} onClick={() => onDraftQuantity(i, line.quantity + 1)}>
                        +
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDraftQuantity(i, 0)}>
                      Verwijderen
                    </Button>
                  )}
                  <span className="w-20 text-right tabular-nums">{formatEuro(line.unitPriceCents * line.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Te betalen</span>
          <span className="font-heading text-2xl font-extrabold tabular-nums">{formatEuro(toPay)}</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="payment-method"
                value={opt.value}
                checked={paymentMethod === opt.value}
                onChange={() => onPaymentMethodChange(opt.value)}
                autoComplete="off"
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Button className="h-12 text-base" disabled={locked || toPay < 1} onClick={onPay}>
            Afrekenen {toPay > 0 && formatEuro(toPay)}
          </Button>
          {tab && draft.length > 0 && (
            <Button variant="outline" disabled={locked} onClick={onSubmitOrder}>
              Bestelling toevoegen aan rekening
            </Button>
          )}
          {!tab && (
            <Button variant="outline" disabled={busy || draft.length === 0} onClick={onPark}>
              Op rekening zetten
            </Button>
          )}
          {tab && tab.totalCents === 0 && tab.paidCents === 0 && draft.length === 0 && (
            <Button variant="ghost" disabled={locked} onClick={onCancelTab}>
              Lege rekening sluiten
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
