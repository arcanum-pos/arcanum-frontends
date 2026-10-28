import { useState } from 'react'
import { Printer as PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages, type Messages } from '@/shared/i18n'
import { cn } from 'cn'
import { printerUrl, testPrint, type PrintJob, type Printer, type PrintState } from './printing'

// A screen's printer (arcanum/PRINTING.md): which one it prints on, how it's
// doing, and what didn't print. In the header: the printer's name with a
// light - green ready, blue printing, red a problem - and how many failed.
// Opened: choose another, open the printer to accept its certificate, a
// test page, and "print again" for what failed.

type Texts = {
  none: string
  title: string
  hint: string
  choose: string
  noPrinters: string
  address: (address: string) => string
  polls: string
  openPrinter: string
  openPrinterHint: string
  test: string
  testSent: string
  failedTitle: string
  again: string
  problem: (code: string) => string
  failedCount: (n: number) => string
}

const problem = (code: string, t: { unreachable: string; paper: string; cover: string; device: string; other: (c: string) => string }) =>
  code === 'unreachable' ? t.unreachable : code === 'EPTR_REC_EMPTY' ? t.paper : code === 'EPTR_COVER_OPEN' ? t.cover : code === 'DeviceNotFound' ? t.device : t.other(code)

const TEXTS: Messages<Texts> = {
  nl: {
    none: 'Geen printer',
    title: 'Printer',
    hint: 'Waar de bonnen van dit station geprint worden. Printers voeg je toe in de console (Toestellen).',
    choose: 'Printer',
    noPrinters: 'Nog geen printers - voeg er een toe in de console (Toestellen).',
    address: (a) => `Op het netwerk: ${a}`,
    polls: 'Deze printer haalt zijn bonnen zelf op bij Arcanum - dit scherm hoeft er niets voor te doen.',
    openPrinter: 'Printer openen',
    openPrinterHint: 'De eerste keer op dit toestel: open de printer en aanvaard zijn certificaat, anders kan dit scherm hem niet bereiken.',
    test: 'Testafdruk',
    testSent: 'Testafdruk gestuurd.',
    failedTitle: 'Niet geprint',
    again: 'Opnieuw',
    problem: (c) => problem(c, { unreachable: 'Printer niet bereikbaar - staat hij aan, en is zijn certificaat aanvaard?', paper: 'Het papier is op', cover: 'De klep staat open', device: 'De printer kent dit toestel-id niet', other: (c) => `Printerfout (${c})` }),
    failedCount: (n) => `${n} niet geprint`,
  },
  fr: {
    none: 'Pas d’imprimante',
    title: 'Imprimante',
    hint: 'Où les bons de ce poste sont imprimés. Les imprimantes s’ajoutent dans la console (Appareils).',
    choose: 'Imprimante',
    noPrinters: 'Pas encore d’imprimante - ajoutez-en une dans la console (Appareils).',
    address: (a) => `Sur le réseau : ${a}`,
    polls: 'Cette imprimante récupère elle-même ses bons chez Arcanum - cet écran n’a rien à faire.',
    openPrinter: 'Ouvrir l’imprimante',
    openPrinterHint: 'La première fois sur cet appareil : ouvrez l’imprimante et acceptez son certificat, sinon cet écran ne peut pas la joindre.',
    test: 'Page de test',
    testSent: 'Page de test envoyée.',
    failedTitle: 'Non imprimé',
    again: 'Réessayer',
    problem: (c) => problem(c, { unreachable: 'Imprimante injoignable - est-elle allumée, et son certificat accepté ?', paper: 'Plus de papier', cover: 'Le capot est ouvert', device: 'L’imprimante ne connaît pas cet identifiant', other: (c) => `Erreur d’imprimante (${c})` }),
    failedCount: (n) => `${n} non imprimé${n > 1 ? 's' : ''}`,
  },
  en: {
    none: 'No printer',
    title: 'Printer',
    hint: "Where this station's tickets print. Printers are added in the console (Devices).",
    choose: 'Printer',
    noPrinters: 'No printers yet - add one in the console (Devices).',
    address: (a) => `On the network: ${a}`,
    polls: 'This printer fetches its tickets from Arcanum itself - this screen has nothing to do for it.',
    openPrinter: 'Open printer',
    openPrinterHint: "The first time on this device: open the printer and accept its certificate, or this screen can't reach it.",
    test: 'Test page',
    testSent: 'Test page sent.',
    failedTitle: 'Not printed',
    again: 'Print again',
    problem: (c) => problem(c, { unreachable: "Printer can't be reached - is it on, and its certificate accepted?", paper: 'Out of paper', cover: 'The cover is open', device: "The printer doesn't know this device id", other: (c) => `Printer error (${c})` }),
    failedCount: (n) => `${n} not printed`,
  },
}

export function PrinterButton({
  orgId,
  printers,
  printer,
  state,
  failed,
  onChoose,
  onRetry,
}: {
  orgId: string
  printers: Printer[]
  printer: Printer | null
  state: PrintState
  failed: PrintJob[]
  onChoose?: (printerId: string | null) => void
  onRetry: (jobId: string) => void
}) {
  const t = useMessages(TEXTS)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const light = !printer ? 'bg-muted-foreground/40' : state.phase === 'problem' || failed.length ? 'bg-red-500' : state.phase === 'printing' ? 'animate-pulse bg-blue-500' : 'bg-green-500'

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2" data-testid="printer-button" data-state={printer ? (state.phase === 'problem' || failed.length ? 'problem' : state.phase) : 'none'}>
        <PrinterIcon aria-hidden="true" />
        <span className={cn('size-2 rounded-full', light)} aria-hidden="true" />
        {printer ? printer.name : t.none}
        {failed.length > 0 && <span className="rounded bg-red-500/15 px-1.5 text-xs font-semibold text-red-700 dark:text-red-400">{t.failedCount(failed.length)}</span>}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setNotice(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.hint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {onChoose &&
              (printers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noPrinters}</p>
              ) : (
                <Select value={printer?.id ?? 'none'} onValueChange={(v) => onChoose(v === 'none' ? null : v)}>
                  <SelectTrigger aria-label={t.choose}>
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
              ))}
            {printer && (
              <>
                <p className="text-sm text-muted-foreground">{printer.connection === 'poll' ? t.polls : t.address(`${printer.host}${printer.port && printer.port !== 443 ? `:${printer.port}` : ''}`)}</p>
                {state.phase === 'problem' && (
                  <p className="text-sm font-medium text-destructive" role="alert" data-testid="printer-problem">
                    {t.problem(state.code)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {printer.connection === 'push' && (
                    <Button variant="outline" asChild>
                      <a href={printerUrl(printer)} target="_blank" rel="noopener">
                        {t.openPrinter}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await testPrint(orgId, printer.id)
                        .then(() => setNotice(t.testSent))
                        .catch((err) => setNotice(err instanceof Error ? err.message : String(err)))
                    }}
                  >
                    {t.test}
                  </Button>
                </div>
                {printer.connection === 'push' && <p className="text-xs text-muted-foreground">{t.openPrinterHint}</p>}
                {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
                {failed.length > 0 && (
                  <div className="grid gap-2" data-testid="printer-failed">
                    <h3 className="text-sm font-medium">{t.failedTitle}</h3>
                    {failed.map((job) => (
                      <div key={job.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{job.title}</span>
                          {job.error && <span className="block text-xs text-muted-foreground">{t.problem(job.error)}</span>}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => onRetry(job.id)}>
                          {t.again}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
