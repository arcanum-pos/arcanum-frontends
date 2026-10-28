import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { createPrinter, pollUrl, updatePrinter, type Printer } from '@/shared/printing'
import { listStations, type Station } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// Workers Free: requests a day (arcanum/PRINTING.md, "Polling cost").
const FREE_REQUESTS_PER_DAY = 100_000

// A printer's settings (arcanum/PRINTING.md): its name, Epson (Star later),
// how it gets its work - it asks Arcanum itself (polling, the default: no
// certificate, no screen) or a screen on its network sends it (push) - and
// then its interval or its address, paper, and which stations' tickets it
// prints. A new polling printer ends on its URL (PollLink). The form only;
// PrinterDialog wraps it for "Bewerken", AddDeviceDialog shows it for a new one.
export function PrinterForm({ orgId, printer, onSaved, onCancel }: { orgId: string; printer?: Printer; onSaved: (p: Printer) => void; onCancel?: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const t = m.printers
  const shell = useMessages(ADMIN_SHELL_MESSAGES)
  const [name, setName] = useState(printer?.name ?? '')
  const [connection, setConnection] = useState<'poll' | 'push'>(printer?.connection ?? 'poll')
  const [interval, setPollSeconds] = useState(String(printer?.pollInterval ?? 10))
  const [host, setHost] = useState(printer?.host ?? '')
  const [port, setPort] = useState(String(printer?.port ?? 443))
  const [paper, setPaper] = useState<'80' | '58'>(printer?.paperMm === 58 ? '58' : '80')
  const [stationIds, setStationIds] = useState<string[]>(printer?.stations.map((s) => s.id) ?? [])
  const [stations, setStations] = useState<Station[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A new polling printer: its URL, shown once.
  const [made, setMade] = useState<Printer | null>(null)

  useEffect(() => {
    listStations(orgId).then(setStations, () => setStations([]))
  }, [orgId])

  const seconds = Math.max(1, Number(interval) || 0)
  const perDay = Math.round(86_400 / seconds)
  const ready = name.trim() && (connection === 'poll' ? seconds >= 3 && seconds <= 300 : host.trim())

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const common = { name: name.trim(), brand: 'epson' as const, connection, paperMm: Number(paper) as 58 | 80, stationIds }
      const body = connection === 'poll' ? { ...common, pollInterval: seconds } : { ...common, host: host.trim(), port: Number(port) || 443 }
      const saved = printer ? await updatePrinter(orgId, printer.id, body) : await createPrinter(orgId, body)
      if (saved.pollKey) setMade(saved)
      else onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (made) return <PollLink printer={made} onDone={() => onSaved(made)} />

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="printer-name">{m.devices.deviceName}</Label>
        <Input id="printer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>{t.brand}</Label>
          <Select value="epson" disabled={!!printer}>
            <SelectTrigger aria-label={t.brand}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="epson">Epson</SelectItem>
              <SelectItem value="star" disabled>
                {t.brandLater}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t.paper}</Label>
          <Select value={paper} onValueChange={(v) => setPaper(v as '80' | '58')}>
            <SelectTrigger aria-label={t.paper}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80">{t.paper80}</SelectItem>
              <SelectItem value="58">{t.paper58}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>{t.connection}</Label>
        <Select value={connection} onValueChange={(v) => setConnection(v as 'poll' | 'push')} disabled={!!printer}>
          <SelectTrigger aria-label={t.connection}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="poll">{t.polling}</SelectItem>
            <SelectItem value="push">{t.viaScreen}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{connection === 'poll' ? t.pollHint : t.pushHint}</p>
      </div>
      {connection === 'poll' ? (
        <div className="grid gap-2">
          <Label htmlFor="printer-interval">{t.interval}</Label>
          <Input id="printer-interval" value={interval} onChange={(e) => setPollSeconds(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="off" className="w-24 font-mono" />
          <p className="text-xs text-muted-foreground" data-testid="interval-cost">
            {t.intervalCost(perDay, Math.round((perDay / FREE_REQUESTS_PER_DAY) * 100))}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="printer-host">{t.host}</Label>
              <Input id="printer-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.50" autoComplete="off" className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="printer-port">{t.port}</Label>
              <Input id="printer-port" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="off" className="font-mono" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t.hostHint}</p>
        </>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t.stations}</legend>
        {stations && stations.length === 0 && <p className="text-sm text-muted-foreground">{t.noStations}</p>}
        {(stations ?? []).map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={stationIds.includes(s.id)}
              onChange={(e) => setStationIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id)))}
            />
            {s.name}
          </label>
        ))}
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            {shell.cancel}
          </Button>
        )}
        <Button onClick={save} disabled={busy || !ready}>
          {busy ? m.devices.busy : printer ? t.save : t.add}
        </Button>
      </DialogFooter>
    </div>
  )
}

// A polling printer's URL with the steps to put it in the printer - shown
// once (only its hash is kept).
export function PollLink({ printer, onDone }: { printer: Printer; onDone: () => void }) {
  const t = useMessages(ADMIN_ORG_MESSAGES).printers
  const [copied, setCopied] = useState(false)
  const url = pollUrl(printer)
  return (
    <div className="grid gap-4" data-testid="poll-link">
      <h3 className="font-medium">{t.urlTitle}</h3>
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-xs" aria-label={t.urlTitle} />
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).then(
              () => setCopied(true),
              () => {}
            )
          }}
        >
          {copied ? t.copied : t.copy}
        </Button>
      </div>
      <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
        {t.urlSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t.urlOnce}</p>
      <DialogFooter>
        <Button onClick={onDone}>{t.done}</Button>
      </DialogFooter>
    </div>
  )
}

export function PrinterDialog({ orgId, printer, onClose, onSaved }: { orgId: string; printer: Printer | null; onClose: () => void; onSaved: () => void }) {
  const t = useMessages(ADMIN_ORG_MESSAGES).printers
  return (
    <Dialog open={!!printer} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{printer ? t.editTitle(printer.name) : ''}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>
        {printer && (
          <PrinterForm
            key={printer.id}
            orgId={orgId}
            printer={printer}
            onCancel={onClose}
            onSaved={() => {
              onClose()
              onSaved()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// "Nieuwe link": the new URL, shown once.
export function NewLinkDialog({ printer, onClose }: { printer: Printer | null; onClose: () => void }) {
  const t = useMessages(ADMIN_ORG_MESSAGES).printers
  return (
    <Dialog open={!!printer} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{printer?.name}</DialogTitle>
          <DialogDescription>{t.pollHint}</DialogDescription>
        </DialogHeader>
        {printer && <PollLink printer={printer} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
