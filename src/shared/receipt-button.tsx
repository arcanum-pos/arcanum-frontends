import { useEffect, useRef, useState } from 'react'
import { Printer as PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/shared/api-errors'
import { useMessages, type Messages } from '@/shared/i18n'
import { printReceipt, type Printer, type ReceiptChoice } from './printing'

// Receipts (arcanum/PRINTING.md), when the organisation has them switched
// on: "Bon printen" after a payment (or by itself, when this device says
// so), and the choice of this device's receipt printer.

type Texts = {
  print: string
  printing: string
  sent: string
  again: string
  printer: string
  none: string
  auto: string
  autoHint: string
  noPrinters: string
}

const TEXTS: Messages<Texts> = {
  nl: {
    print: 'Bon printen',
    printing: 'Bon wordt gestuurd…',
    sent: 'Bon naar de printer gestuurd',
    again: 'Nog een bon',
    printer: 'Bonprinter',
    none: 'Geen printer',
    auto: 'Na elke betaling vanzelf een bon',
    autoHint: 'Anders print je een bon met de knop na de betaling.',
    noPrinters: 'Nog geen printers - voeg er een toe in de console (Toestellen).',
  },
  fr: {
    print: 'Imprimer le ticket',
    printing: 'Envoi du ticket…',
    sent: 'Ticket envoyé à l’imprimante',
    again: 'Encore un ticket',
    printer: 'Imprimante de tickets',
    none: 'Pas d’imprimante',
    auto: 'Un ticket après chaque paiement, automatiquement',
    autoHint: 'Sinon, imprimez un ticket avec le bouton après le paiement.',
    noPrinters: 'Pas encore d’imprimante - ajoutez-en une dans la console (Appareils).',
  },
  en: {
    print: 'Print receipt',
    printing: 'Sending receipt…',
    sent: 'Receipt sent to the printer',
    again: 'Another receipt',
    printer: 'Receipt printer',
    none: 'No printer',
    auto: 'A receipt after every payment, automatically',
    autoHint: 'Otherwise, print one with the button after the payment.',
    noPrinters: 'No printers yet - add one in the console (Devices).',
  },
}

// After a payment: prints by itself once when `auto`, else on the button.
export function ReceiptButton({ orgId, printer, tabId, chargeId, auto, className }: { orgId: string; printer: Printer; tabId: string; chargeId?: string; auto: boolean; className?: string }) {
  const t = useMessages(TEXTS)
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' })
  const done = useRef(false)

  async function print() {
    setState({ kind: 'busy' })
    try {
      await printReceipt(orgId, printer.id, tabId, chargeId)
      setState({ kind: 'sent' })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : apiErrorMessage(null, String(err)) })
    }
  }

  useEffect(() => {
    if (auto && !done.current) {
      done.current = true
      void print()
    }
    // Once per payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={className} data-testid="receipt">
      <Button variant="outline" className="h-10 w-full gap-2 rounded-[10px]" disabled={state.kind === 'busy'} onClick={print}>
        <PrinterIcon aria-hidden="true" />
        {state.kind === 'busy' ? t.printing : state.kind === 'sent' ? t.again : t.print}
      </Button>
      {state.kind === 'sent' && <p className="mt-1.5 text-center text-xs text-muted-foreground">{t.sent}</p>}
      {state.kind === 'error' && (
        <p className="mt-1.5 text-center text-xs text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </div>
  )
}

// This device's receipt printer, and whether it prints after every payment.
export function ReceiptPrinterChoice({ printers, choice, onChoose }: { printers: Printer[]; choice: ReceiptChoice; onChoose: (c: ReceiptChoice) => void }) {
  const t = useMessages(TEXTS)
  if (printers.length === 0) return <p className="text-sm text-muted-foreground">{t.noPrinters}</p>
  return (
    <div className="grid gap-3" data-testid="receipt-printer">
      <Select value={choice.printerId ?? 'none'} onValueChange={(v) => onChoose({ ...choice, printerId: v === 'none' ? null : v })}>
        <SelectTrigger aria-label={t.printer}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t.none}</SelectItem>
          {printers.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choice.printerId && (
        <label className="flex items-start gap-3 text-sm">
          <Switch checked={choice.auto} onCheckedChange={(auto) => onChoose({ ...choice, auto })} aria-label={t.auto} />
          <span>
            {t.auto}
            <span className="block text-xs text-muted-foreground">{t.autoHint}</span>
          </span>
        </label>
      )}
    </div>
  )
}
