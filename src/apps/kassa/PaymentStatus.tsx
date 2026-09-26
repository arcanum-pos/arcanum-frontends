import { Button } from '@/components/ui/button'
import { formatEuro } from '@/shared/format'
import { STATUS_LABELS } from '@/shared/payment-labels'
import { isPaymentResolved, MANUAL_METHOD_LABELS, PAYMENT_METHOD_OPTIONS, type CurrentPayment } from './lib'

// A payment in progress, in place of the kassa (styled after the payment
// dialog in design_files/): the method, the amount, the QR or what to do,
// and a clear "paid" state before the next customer.
export function PaymentStatus({
  current,
  manualStatusText,
  countdownText,
  showConfirmButton,
  onConfirm,
  onCancel,
  onNext,
}: {
  current: CurrentPayment
  manualStatusText: string
  countdownText: string
  showConfirmButton: boolean
  onConfirm: () => void
  onCancel: () => void
  onNext: () => void
}) {
  const isManual = current.method === 'cash' || current.method === 'sumup'
  const resolved = isPaymentResolved(current)
  const methodLabel = PAYMENT_METHOD_OPTIONS.find((o) => o.value === current.method)?.label ?? current.method

  return (
    <div className="mx-auto w-full max-w-[440px] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 rounded-2xl border bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,.18)] duration-200">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center self-stretch">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-foreground/70 uppercase">{methodLabel}</span>
          {current.part && (
            <span className="ml-auto rounded-md border px-1.5 py-0.5 text-[11px] font-semibold" data-testid="payment-part">
              Deel {current.part.index} van {current.part.of}
            </span>
          )}
        </div>

        {resolved && (
          <div className="flex size-[54px] items-center justify-center rounded-full bg-green-100 text-[26px] text-green-700 dark:bg-green-950 dark:text-green-300" aria-hidden="true">
            ✓
          </div>
        )}

        {current.breakdown.length > 0 && (
          <div className="flex flex-col items-center gap-0.5">
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
                <img src={current.qrCodeUrl} alt="QR-code voor betaling" className="size-[min(60vw,280px)]" />
              </div>
            )}
            <p className="flex items-center gap-2 text-[13px] text-foreground/75">
              {!resolved && <Spinner />}
              <span>
                Status: <strong>{STATUS_LABELS[current.status] || current.status}</strong>
              </span>
            </p>
            {countdownText && !resolved && <p className="font-mono text-xs text-muted-foreground">{countdownText}</p>}
          </>
        )}

        {isManual && (
          <>
            <p className="flex items-center gap-2 text-[13px] text-foreground/75">
              {!resolved && current.method === 'sumup' && <Spinner />}
              <span>{manualStatusText}</span>
            </p>
            {showConfirmButton && (
              <Button className="h-11 w-full rounded-[10px] text-sm" onClick={onConfirm}>
                {MANUAL_METHOD_LABELS[current.method as 'cash' | 'sumup'].confirmBtn}
              </Button>
            )}
          </>
        )}

        {resolved ? (
          <Button className="mt-1 h-11 w-full rounded-[10px] text-sm" onClick={onNext}>
            {current.remainsOpen ? (current.part ? 'Volgend deel' : 'Volgende persoon') : 'Volgende klant'}
          </Button>
        ) : (
          <Button variant="outline" className="h-10 w-full rounded-[10px]" onClick={onCancel}>
            Terug naar rekening
          </Button>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block size-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
}
