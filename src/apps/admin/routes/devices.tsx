import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { listDevicePairings, listOrgDevices, listSumupReaders, removeDevice, removeSumupReader, revokeDevicePairing, type OrgDevice, type SumupReader } from '../lib/api'
import { AddDeviceDialog } from '../components/add-device-dialog'
import { RepairDeviceDialog } from '../components/repair-device-dialog'
import { RowActions } from '../components/row-actions'
import { NewLinkDialog, PrinterDialog } from '../components/printer-dialog'
import { deletePrinter, getReceiptsEnabled, listPrinters, newPrinterKey, pollingLately, setReceiptsEnabled, testPrint, type Printer } from '@/shared/printing'
import { Switch } from '@/components/ui/switch'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

const READER_MODEL_LABELS: Record<string, string> = {
  solo: 'SumUp Solo',
  'virtual-solo': 'SumUp Virtual Solo',
}

// Labels: messages' devices.readerStatus.
type ReaderStatus = 'paired' | 'processing' | 'expired' | 'unknown'
const READER_STATUS_BADGE: Record<ReaderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paired: 'default',
  processing: 'outline',
  expired: 'destructive',
  unknown: 'secondary',
}

function readerStatus(status: string): ReaderStatus {
  return status in READER_STATUS_BADGE ? (status as ReaderStatus) : 'unknown'
}

// Online green, offline orange: a light and the word, readable at a glance.
// (A SumUp reader only says whether it's paired: that stays a plain badge.)
function OnlineBadge({ online, label }: { online: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={online ? 'gap-1.5 border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400' : 'gap-1.5 border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400'}
      data-testid={online ? 'device-online' : 'device-offline'}
    >
      <span className={online ? 'size-2 rounded-full bg-green-500' : 'size-2 rounded-full bg-orange-500'} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export default function DevicesPage() {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const intlLocale = INTL_LOCALES[useLocale().locale]
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: devices, loading, error, reload } = useAsync(
    () => (orgId ? listOrgDevices(orgId) : Promise.resolve([])),
    [orgId]
  )
  // Fetched live from SumUp, not stored by us. Pairing (by the code the
  // reader shows) and unpairing go to SumUp too; the list shows the result.
  const { data: sumupReaders, error: sumupError, reload: reloadReaders } = useAsync(
    () =>
      orgId
        ? listSumupReaders(orgId)
        : Promise.resolve({ configured: false, readers: [] as SumupReader[], error: undefined as string | undefined }),
    [orgId]
  )

  // Open pairing codes (admins only — anyone else gets none).
  const { data: pairings, reload: reloadPairings } = useAsync(
    () => (orgId ? listDevicePairings(orgId).catch(() => []) : Promise.resolve([])),
    [orgId]
  )
  const openPairings = (pairings ?? []).filter((p) => p.status === 'open' && Date.parse(p.expiresAt) > Date.now())
  const [deviceError, setDeviceError] = useState<string | null>(null)
  // "Gekoppeld aan": the kassa's name when it has one.
  const nameOf = (terminalId: string) => devices?.find((d) => d.terminal_id === terminalId)?.name ?? null

  const [removingId, setRemovingId] = useState<string | null>(null)
  // "Opnieuw koppelen": the device a re-pair code is shown for.
  const [repairing, setRepairing] = useState<OrgDevice | null>(null)
  const [readerNotice, setReaderNotice] = useState<string | null>(null)

  // Printers (arcanum/PRINTING.md): devices of the org without a pairing -
  // their address on the network; a screen there prints on them.
  const { data: printers, reload: reloadPrinters } = useAsync(() => (orgId ? listPrinters(orgId).catch(() => [] as Printer[]) : Promise.resolve([] as Printer[])), [orgId])
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  // Receipts at the kassa and in table service: on per organisation.
  const { data: receiptsOn, reload: reloadReceipts } = useAsync(() => (orgId ? getReceiptsEnabled(orgId).catch(() => false) : Promise.resolve(false)), [orgId])

  // "Nieuwe link": the printer with its new URL, shown once.
  const [newLink, setNewLink] = useState<Printer | null>(null)

  async function handleNewLink(printer: Printer) {
    if (!orgId || !window.confirm(m.printers.confirmNewLink(printer.name))) return
    setDeviceError(null)
    try {
      setNewLink(await newPrinterKey(orgId, printer.id))
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRemovePrinter(printer: Printer) {
    if (!orgId || !window.confirm(m.printers.confirmRemove(printer.name))) return
    setRemovingId(printer.id)
    setDeviceError(null)
    try {
      await deletePrinter(orgId, printer.id)
      reloadPrinters()
    } catch (err) {
      setDeviceError(m.devices.removeFailed(err instanceof Error ? err.message : String(err)))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleTestPrinter(printer: Printer) {
    if (!orgId) return
    setDeviceError(null)
    try {
      await testPrint(orgId, printer.id)
      setReaderNotice(m.printers.testSent(printer.name))
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : String(err))
    }
  }

  // Removing a reader unpairs it at SumUp: one word for both, like any device.
  async function handleRemoveReader(reader: SumupReader) {
    if (!orgId) return
    if (!window.confirm(m.devices.confirmRemoveReader(reader.name))) return
    setRemovingId(reader.id)
    setReaderNotice(null)
    try {
      await removeSumupReader(orgId, reader.id)
      reloadReaders()
    } catch (err) {
      setReaderNotice(m.devices.removeFailed(err instanceof Error ? err.message : String(err)))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRemove(device: OrgDevice) {
    if (!orgId || !window.confirm(m.devices.confirmRemoveDevice(device.name || device.terminal_id))) return
    setRemovingId(device.terminal_id)
    setDeviceError(null)
    try {
      await removeDevice(orgId, device.terminal_id)
      reload()
    } catch (err) {
      setDeviceError(m.devices.removeFailed(err instanceof Error ? err.message : String(err)))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRevoke(id: string) {
    if (!orgId) return
    await revokeDevicePairing(orgId, id).catch(() => {})
    reloadPairings()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.devices.title}</h1>
          <p className="text-muted-foreground">{m.devices.subtitle(currentOrg?.name ?? m.thisOrg)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {orgId && (
            <AddDeviceDialog
              orgId={orgId}
              kassas={(devices ?? []).filter((d) => d.role === 'pos')}
              sumup={!!sumupReaders?.configured}
              onPaired={() => {
                reload()
                reloadPairings()
              }}
              onReaderPaired={(reader) => {
                setReaderNotice(m.devices.paired(reader.name))
                reloadReaders()
              }}
              onPrinterAdded={(printer) => {
                setReaderNotice(m.printers.added(printer.name))
                reloadPrinters()
              }}
            />
          )}
        </div>
      </div>
      {readerNotice && <p className="text-sm text-muted-foreground">{readerNotice}</p>}

      {error && <p className="text-sm text-destructive">{m.devices.loadError(error)}</p>}
      {deviceError && <p className="text-sm text-destructive">{deviceError}</p>}
      {openPairings.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="open-pairings">
          <h2 className="text-sm font-medium">{m.devices.openCodes}</h2>
          {openPairings.map((p) => {
            const minutes = Math.max(1, Math.round((Date.parse(p.expiresAt) - Date.now()) / 60_000))
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  {p.view === 'pickup' ? m.devices.pickupScreen : p.view === 'tables' ? m.devices.entranceScreen : m.devices.roles[p.role]} · {m.devices.codeFor(p.name, `${minutes} min`)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => handleRevoke(p.id)}>
                  {m.devices.revoke}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      {(sumupError || sumupReaders?.error) && (
        <p className="text-sm text-destructive">{m.devices.readersError(sumupError ?? sumupReaders?.error ?? '')}</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.devices.id}</TableHead>
            <TableHead>{m.devices.type}</TableHead>
            <TableHead>{m.devices.linkedTo}</TableHead>
            <TableHead>{m.devices.registeredAt}</TableHead>
            <TableHead>{m.status}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && devices?.length === 0 && !sumupReaders?.readers.length && !printers?.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {m.devices.empty}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            sumupReaders?.readers.map((reader) => {
              const status = readerStatus(reader.status)
              return (
                <TableRow key={`sumup-${reader.id}`}>
                  <TableCell>
                    <div className="font-medium">{reader.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{reader.id}</div>
                  </TableCell>
                  <TableCell>{(reader.model && READER_MODEL_LABELS[reader.model]) ?? m.devices.reader}</TableCell>
                  <TableCell className="text-muted-foreground">-</TableCell>
                  <TableCell className="text-muted-foreground">-</TableCell>
                  <TableCell>
                    <Badge variant={READER_STATUS_BADGE[status]}>{m.devices.readerStatus[status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions name={reader.name} disabled={removingId === reader.id} actions={[{ label: m.remove, destructive: true, onSelect: () => handleRemoveReader(reader) }]} />
                  </TableCell>
                </TableRow>
              )
            })}
          {!loading &&
            devices?.map((device) => (
              <TableRow key={device.terminal_id}>
                <TableCell>
                  {device.name && <div className="font-medium">{device.name}</div>}
                  <div className="font-mono text-xs text-muted-foreground">{device.terminal_id}</div>
                </TableCell>
                <TableCell>
                  {device.role === 'station' && device.view === 'pickup' ? m.devices.pickupScreen : device.role === 'station' && device.view === 'tables' ? m.devices.entranceScreen : (m.devices.roles[device.role] ?? device.role)}
                  {device.role === 'station' && device.station_name && <div className="text-xs text-muted-foreground">{m.devices.stationOf(device.station_name)}</div>}
                </TableCell>
                <TableCell className={device.linked_to ? (nameOf(device.linked_to) ? undefined : 'font-mono text-xs') : 'text-muted-foreground'}>
                  {device.linked_to ? (nameOf(device.linked_to) ?? device.linked_to) : '-'}
                </TableCell>
                <TableCell>{new Date(device.created_at).toLocaleString(intlLocale)}</TableCell>
                <TableCell>
                  <OnlineBadge online={!!device.online} label={device.online ? m.devices.online : m.devices.offline} />
                </TableCell>
                <TableCell>
                  <RowActions
                    name={device.name || device.terminal_id}
                    disabled={removingId === device.terminal_id}
                    actions={[
                      // A kassa's own second window has no pairing of its own.
                      !device.terminal_id.startsWith('display-of-') && { label: m.devices.repair, onSelect: () => setRepairing(device) },
                      { label: m.remove, destructive: true, onSelect: () => handleRemove(device) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          {!loading &&
            printers?.map((printer) => (
              <TableRow key={`printer-${printer.id}`} data-testid={`printer-${printer.name}`}>
                <TableCell>
                  <div className="font-medium">{printer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {printer.connection === 'poll' ? (
                      m.printers.pollLabel
                    ) : (
                      <span className="font-mono">
                        {printer.host}
                        {printer.port && printer.port !== 443 ? `:${printer.port}` : ''}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {m.printers.typeLabel(printer.brand === 'epson' ? 'Epson' : 'Star')}
                  <div className="text-xs text-muted-foreground">{printer.paperMm} mm</div>
                </TableCell>
                <TableCell className={printer.stations.length ? undefined : 'text-muted-foreground'}>
                  {printer.stations.length ? m.printers.printsFor(printer.stations.map((st) => st.name).join(', ')) : m.printers.printsNothing}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {printer.connection === 'poll' ? (printer.lastPollAt ? m.printers.lastPoll(new Date(printer.lastPollAt).toLocaleString(intlLocale)) : m.printers.neverPolled) : '-'}
                </TableCell>
                <TableCell>
                  {printer.connection === 'poll' ? (
                    <OnlineBadge online={pollingLately(printer)} label={pollingLately(printer) ? m.printers.pollingBadge : m.printers.notPollingBadge} />
                  ) : (
                    <Badge variant="outline">{m.printers.viaScreenBadge}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <RowActions
                    name={printer.name}
                    disabled={removingId === printer.id}
                    actions={[
                      { label: m.printers.edit, onSelect: () => setEditingPrinter(printer) },
                      { label: m.printers.test, onSelect: () => handleTestPrinter(printer) },
                      printer.connection === 'poll' && { label: m.printers.newLink, onSelect: () => handleNewLink(printer) },
                      { label: m.remove, destructive: true, onSelect: () => handleRemovePrinter(printer) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {orgId && <PrinterDialog orgId={orgId} printer={editingPrinter} onClose={() => setEditingPrinter(null)} onSaved={reloadPrinters} />}
      <NewLinkDialog printer={newLink} onClose={() => setNewLink(null)} />

      {orgId && (
        <RepairDeviceDialog
          orgId={orgId}
          device={repairing}
          onClose={() => setRepairing(null)}
          onRepaired={() => {
            reload()
            reloadPairings()
          }}
        />
      )}

      {orgId && (
        <label className="flex items-start gap-3 rounded-lg border p-4" data-testid="receipts-setting">
          <Switch
            checked={!!receiptsOn}
            onCheckedChange={async (on) => {
              await setReceiptsEnabled(orgId, on).catch((err) => setDeviceError(err instanceof Error ? err.message : String(err)))
              reloadReceipts()
            }}
            aria-label={m.printers.receiptsTitle}
          />
          <span>
            <span className="block text-sm font-medium">{m.printers.receiptsTitle}</span>
            <span className="block text-sm text-muted-foreground">{m.printers.receiptsHint}</span>
          </span>
        </label>
      )}

      <p className="text-sm text-muted-foreground">{m.devices.footnote}</p>
    </div>
  )
}
