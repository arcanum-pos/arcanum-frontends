import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatEuro } from '@/shared/format'
import { STATUS_LABELS } from '@/shared/payment-labels'
import { isPaymentResolved, MANUAL_METHOD_LABELS, type CurrentPayment } from './lib'

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

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        {current.breakdown.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            {current.breakdown.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}
        <p className="font-heading text-3xl font-extrabold">{formatEuro(current.amountCents)}</p>

        {!isManual && (
          <>
            {current.qrCodeUrl && <img src={current.qrCodeUrl} alt="QR-code voor betaling" className="size-[min(60vw,320px)]" />}
            <p>
              Status: <strong>{STATUS_LABELS[current.status] || current.status}</strong>
            </p>
            {countdownText && <p className="text-sm text-muted-foreground">{countdownText}</p>}
          </>
        )}

        {isManual && (
          <>
            <p>{manualStatusText}</p>
            {showConfirmButton && <Button onClick={onConfirm}>{MANUAL_METHOD_LABELS[current.method as 'cash' | 'sumup'].confirmBtn}</Button>}
          </>
        )}

        {isPaymentResolved(current) ? (
          <Button onClick={onNext}>Volgende klant</Button>
        ) : (
          <Button variant="secondary" onClick={onCancel}>
            Terug naar rekening
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
