import { useState } from 'react'
import { Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatEuro } from '@/shared/format'
import { useMessages } from '@/shared/i18n'
import { STATUS_MESSAGES } from '@/shared/payment-labels'
import { cashChange, changeInDenominations, centsToInput, isPaymentResolved, likelyNotes, readAmountCents, tapLink, type CurrentPayment, type ManualStatus } from './lib'
import { KASSA_MESSAGES } from './messages'

// A payment in progress, in place of the kassa (styled after the payment
// dialog in design_files/): the method, the amount, the QR or what to do,
// and a clear "paid" state before the next customer.
export function PaymentStatus({
  current,
  manualStatus,
  countdownText,
  showConfirmButton,
  onConfirm,
  onCancel,
  onNext,
  receipt,
}: {
  current: CurrentPayment
  manualStatus: ManualStatus | null
  countdownText: string
  showConfirmButton: boolean
  // Cash: with the change kept as a tip ("keep the change"), in cents.
  onConfirm: (extraTipCents?: number) => void
  onCancel: () => void
  onNext: () => void
  // Once paid: "Bon printen" (when the org has receipts and this kassa a printer).
  receipt?: React.ReactNode
}) {
  const isManual = current.method === 'cash' || current.method === 'sumup' || current.method === 'tap'
  const resolved = isPaymentResolved(current)
  const m = useMessages(KASSA_MESSAGES)
  // Cash: what the customer handed over (optional), for the change.
  const [received, setReceived] = useState('')
  const receivedCents = readAmountCents(received)
  const change = current.method === 'cash' ? cashChange(current, receivedCents) : 0
  const tooLittle = receivedCents > 0 && receivedCents < current.amountCents
  const statusLabels = useMessages(STATUS_MESSAGES)
  const methodLabel = m.methods[current.method] ?? current.method
  const manual = isManual ? m.manual[current.method as 'cash' | 'sumup' | 'tap'] : null
  const manualText = !manual || !manualStatus
    ? ''
    : manualStatus.kind === 'waiting'
      ? manual.waiting
      : manualStatus.kind === 'paid'
        ? manual.paid
        : manualStatus.error
          ? m.sumupFailed(manualStatus.error)
          : m.sumupFailedRetry

  return (
    <div className="mx-auto w-full max-w-[440px] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 rounded-2xl border bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,.18)] duration-200">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center self-stretch">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{methodLabel}</span>
          {current.part && (
            <span className="ml-auto rounded-md border px-1.5 py-0.5 text-[11px] font-semibold" data-testid="payment-part">
              {m.part(current.part.index, current.part.of)}
            </span>
          )}
        </div>

        {resolved && (
          <div className="flex size-[54px] items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" aria-hidden="true" data-testid="payment-paid-mark">
            {/* An icon, not the check character (slanted in many fonts). */}
            <Check className="size-7" strokeWidth={3} />
          </div>
        )}

        {current.breakdown.length > 0 && (
          <div className="flex flex-col items-center gap-0.5" data-testid="payment-breakdown">
            {current.breakdown.map((line, i) => (
              <p key={i} className="text-[13px] text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}
        <p className="font-mono text-[38px] leading-none font-semibold tracking-tight tabular-nums">{formatEuro(current.amountCents)}</p>

        {!isManual && (
          <>
            {current.qrCodeUrl && !resolved && (
              <div className="rounded-2xl border bg-white p-3.5">
                <img src={current.qrCodeUrl} alt={m.qrAlt} className="size-[min(60vw,280px)]" />
              </div>
            )}
            <p className="flex items-center gap-2 text-[13px] text-foreground/75">
              {!resolved && <Spinner />}
              <span>
                {m.status} <strong>{statusLabels[current.status] || current.status}</strong>
              </span>
            </p>
            {countdownText && !resolved && <p className="font-mono text-xs text-muted-foreground">{countdownText}</p>}
          </>
        )}

        {isManual && (
          <>
            {/* Tap to Pay: the kassa's phone got it; any phone with the SumUp app can scan this. */}
            {current.method === 'tap' && current.tapToken && !resolved && (
              <div className="flex flex-col items-center gap-2" data-testid="tap-qr" data-link={tapLink(window.location.origin, current.chargeId, current.tapToken)}>
                <div className="rounded-2xl border bg-white p-3.5">
                  <QRCodeSVG value={tapLink(window.location.origin, current.chargeId, current.tapToken)} size={200} marginSize={0} title={m.tapQrAlt} />
                </div>
                <p className="max-w-[300px] text-[12.5px] text-muted-foreground">{m.tapHint}</p>
              </div>
            )}
            <p className="flex items-center gap-2 text-[13px] text-foreground/75">
              {!resolved && (current.method === 'sumup' || current.method === 'tap') && <Spinner />}
              <span>{manualText}</span>
            </p>
            {showConfirmButton && current.method === 'cash' && (
              <div className="flex w-full flex-col gap-2" data-testid="cash-received">
                <label className="flex items-center gap-3 text-left text-[13px]">
                  <span className="shrink-0 text-foreground/75">{m.received}</span>
                  <Input
                    inputMode="decimal"
                    placeholder={formatEuro(current.amountCents)}
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    className="h-10 text-right font-mono tabular-nums"
                    data-testid="cash-received-input"
                  />
                </label>
                <div className="flex gap-2">
                  {likelyNotes(current.amountCents).map((note) => (
                    <Button key={note} variant="outline" className="h-9 flex-1 rounded-[10px] font-mono text-[13px] tabular-nums" onClick={() => setReceived(centsToInput(note))}>
                      {formatEuro(note)}
                    </Button>
                  ))}
                </div>
                {change > 0 && (
                  <div className="rounded-[10px] border bg-muted/40 px-3 py-2 text-left" data-testid="cash-change">
                    <p className="flex justify-between text-[13px] font-semibold">
                      <span>{m.changeBack}</span>
                      <span className="font-mono tabular-nums">{formatEuro(change)}</span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground" data-testid="cash-change-coins">
                      {changeInDenominations(change).map((d) => `${d.count} × ${formatEuro(d.cents)}`).join('  ·  ')}
                    </p>
                  </div>
                )}
                {tooLittle && <p className="text-[12.5px] text-destructive" data-testid="cash-too-little">{m.receivedTooLittle(formatEuro(current.amountCents - receivedCents))}</p>}
              </div>
            )}
            {showConfirmButton && change > 0 ? (
              <div className="flex w-full flex-col gap-2">
                <Button className="h-11 w-full rounded-[10px] text-sm" onClick={() => onConfirm(0)} data-testid="cash-give-change">
                  {m.paidGiveChange(formatEuro(change))}
                </Button>
                <Button variant="secondary" className="h-11 w-full rounded-[10px] text-sm" onClick={() => onConfirm(change)} data-testid="cash-keep-tip">
                  {m.paidKeepTip(formatEuro(change))}
                </Button>
              </div>
            ) : showConfirmButton && (
              <Button className="h-11 w-full rounded-[10px] text-sm" onClick={() => onConfirm(0)}>
                {manual?.confirm}
              </Button>
            )}
          </>
        )}

        {resolved && receipt && <div className="w-full">{receipt}</div>}
        {resolved ? (
          <Button className="mt-1 h-11 w-full rounded-[10px] text-sm" onClick={onNext}>
            {current.remainsOpen ? (current.part ? m.nextPart : m.nextPerson) : m.nextCustomer}
          </Button>
        ) : (
          <Button variant="outline" className="h-10 w-full rounded-[10px]" onClick={onCancel}>
            {m.cancelPayment}
          </Button>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block size-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
}
