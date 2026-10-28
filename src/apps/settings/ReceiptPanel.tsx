import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { useReceiptPrinter } from '@/shared/printing'
import { ReceiptPrinterChoice } from '@/shared/receipt-button'
import { SETTINGS_MESSAGES } from './messages'

// This kassa's receipt printer (arcanum/PRINTING.md) - only when the
// organisation has receipts switched on (console, Toestellen). Per browser,
// like the SumUp reader.
export function ReceiptPanel({ posOrgId }: { posOrgId: string }) {
  const m = useMessages(SETTINGS_MESSAGES)
  const receipt = useReceiptPrinter(posOrgId)
  if (!receipt.enabled) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.receiptPrinter}</CardTitle>
        <p className="text-sm text-muted-foreground">{m.receiptPrinterHint}</p>
      </CardHeader>
      <CardContent>
        <ReceiptPrinterChoice printers={receipt.printers} choice={receipt.choice} onChoose={receipt.choose} />
      </CardContent>
    </Card>
  )
}
