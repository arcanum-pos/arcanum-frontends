import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/shared/i18n'
import { createPrinter, updatePrinter, type Printer } from '@/shared/printing'
import { listStations, type Station } from '../lib/catalog-api'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// A printer's settings (arcanum/PRINTING.md): its name, Epson (Star later),
// via a screen on the same network (the printer polling: later), its
// address, paper, and which stations' tickets it prints. The form only;
// PrinterDialog wraps it for "Bewerken", AddDeviceDialog shows it for a new one.
export function PrinterForm({ orgId, printer, onSaved, onCancel }: { orgId: string; printer?: Printer; onSaved: (p: Printer) => void; onCancel?: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const t = m.printers
  const shell = useMessages(ADMIN_SHELL_MESSAGES)
  const [name, setName] = useState(printer?.name ?? '')
  const [host, setHost] = useState(printer?.host ?? '')
  const [port, setPort] = useState(String(printer?.port ?? 443))
  const [paper, setPaper] = useState<'80' | '58'>(printer?.paperMm === 58 ? '58' : '80')
  const [stationIds, setStationIds] = useState<string[]>(printer?.stations.map((s) => s.id) ?? [])
  const [stations, setStations] = useState<Station[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listStations(orgId).then(setStations, () => setStations([]))
  }, [orgId])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const body = { name: name.trim(), brand: 'epson' as const, connection: 'push' as const, host: host.trim(), port: Number(port) || 443, paperMm: Number(paper) as 58 | 80, stationIds }
      onSaved(printer ? await updatePrinter(orgId, printer.id, body) : await createPrinter(orgId, body))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

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
        <Select value="push" disabled={!!printer}>
          <SelectTrigger aria-label={t.connection}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="push">{t.viaScreen}</SelectItem>
            <SelectItem value="poll" disabled>
              {t.polling}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
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
        <Button onClick={save} disabled={busy || !name.trim() || !host.trim()}>
          {busy ? m.devices.busy : printer ? t.save : t.add}
        </Button>
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
