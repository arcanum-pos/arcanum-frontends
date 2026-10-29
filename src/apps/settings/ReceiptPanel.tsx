import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { useReceiptPrinter } from '@/shared/printing'
import { PrinterTrust } from '@/shared/printer-trust'
import { ReceiptPrinterChoice } from '@/shared/receipt-button'
import { SETTINGS_MESSAGES } from './messages'

// This kassa's receipt printer (arcanum/PRINTING.md) - only when the
// organisation has receipts switched on (console, Toestellen). Per browser,
// like the SumUp reader.
export function ReceiptPanel({ posOrgId }: { posOrgId: string }) {
  const m = useMessages(SETTINGS_MESSAGES)
  const receipt = useReceiptPrinter(posOrgId)
  if (!receipt.enabled) return null
  // A printer that a screen sends to: does this kassa reach it, and how to trust it.
  const chosen = receipt.printers.find((p) => p.id === receipt.choice.printerId)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.receiptPrinter}</CardTitle>
        <p className="text-sm text-muted-foreground">{m.receiptPrinterHint}</p>
      </CardHeader>
      <CardContent>
        <ReceiptPrinterChoice printers={receipt.printers} choice={receipt.choice} onChoose={receipt.choose} />
        {chosen?.connection === 'push' && (
          <div className="mt-4">
            <PrinterTrust key={chosen.id} orgId={posOrgId} printer={chosen} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
