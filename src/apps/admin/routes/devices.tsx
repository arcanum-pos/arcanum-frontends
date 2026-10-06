import { useState } from 'react'
import { Link2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { listOrgDevices, listSumupReaders, pairSumupReader, removeDevice, removeSumupReader, type SumupReader } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'
import { docsUrl } from '@/shared/docs-url'

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

  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pairOpen, setPairOpen] = useState(false)
  const [pairingCode, setPairingCode] = useState('')
  const [readerName, setReaderName] = useState('')
  const [pairing, setPairing] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)
  const [readerNotice, setReaderNotice] = useState<string | null>(null)

  async function handlePair() {
    if (!orgId || !pairingCode.trim()) return
    setPairing(true)
    setPairError(null)
    try {
      const reader = await pairSumupReader(orgId, pairingCode, readerName)
      setPairingCode('')
      setReaderName('')
      setPairOpen(false)
      setReaderNotice(m.devices.paired(reader.name))
      reloadReaders()
    } catch (err) {
      setPairError(err instanceof Error ? err.message : String(err))
    } finally {
      setPairing(false)
    }
  }

  async function handleUnpair(reader: SumupReader) {
    if (!orgId) return
    if (!window.confirm(m.devices.confirmUnpair(reader.name))) return
    setRemovingId(reader.id)
    setReaderNotice(null)
    try {
      await removeSumupReader(orgId, reader.id)
      reloadReaders()
    } catch (err) {
      setReaderNotice(m.devices.unpairError(err instanceof Error ? err.message : String(err)))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRemove(terminalId: string) {
    if (!window.confirm(m.devices.confirmRemove(terminalId))) return
    setRemovingId(terminalId)
    try {
      await removeDevice(terminalId)
      reload()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.devices.title}</h1>
          <p className="text-muted-foreground">{m.devices.subtitle(currentOrg?.name ?? m.thisOrg)}</p>
        </div>
        {sumupReaders?.configured && (
          <Dialog open={pairOpen} onOpenChange={setPairOpen}>
            <DialogTrigger asChild>
              <Button>
                <Link2 />
                {m.devices.pairReader}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{m.devices.pairReader}</DialogTitle>
                <DialogDescription>
                  {m.devices.pairHint}{' '}
                  <a href={docsUrl('sumup')} target="_blank" rel="noopener" className="underline underline-offset-4">
                    {m.devices.moreInfo}
                  </a>
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pairing-code">{m.devices.pairingCode}</Label>
                  <Input
                    id="pairing-code"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    autoComplete="off"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reader-name">{m.devices.readerName}</Label>
                  <Input id="reader-name" value={readerName} onChange={(e) => setReaderName(e.target.value)} placeholder="Solo" autoComplete="off" />
                </div>
                {pairError && <p className="text-sm text-destructive">{pairError}</p>}
              </div>
              <DialogFooter>
                <Button onClick={handlePair} disabled={pairing || !pairingCode.trim()}>
                  {pairing ? m.busy : m.devices.pair}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {readerNotice && <p className="text-sm text-muted-foreground">{readerNotice}</p>}

      {error && <p className="text-sm text-destructive">{m.devices.loadError(error)}</p>}
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
          {!loading && devices?.length === 0 && !sumupReaders?.readers.length && (
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
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <Badge variant={READER_STATUS_BADGE[status]}>{m.devices.readerStatus[status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" disabled={removingId === reader.id} aria-label={m.devices.readerActions(reader.name)}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onClick={() => handleUnpair(reader)}>
                          {m.devices.unpair}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          {!loading &&
            devices?.map((device) => (
              <TableRow key={device.terminal_id}>
                <TableCell className="font-mono text-xs">{device.terminal_id}</TableCell>
                <TableCell>{m.devices.roles[device.role] ?? device.role}</TableCell>
                <TableCell className="font-mono text-xs">{device.linked_to ?? '—'}</TableCell>
                <TableCell>{new Date(device.created_at).toLocaleString(intlLocale)}</TableCell>
                <TableCell>
                  <Badge variant={device.online ? 'default' : 'secondary'}>
                    {device.online ? m.devices.online : m.devices.offline}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" disabled={removingId === device.terminal_id}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => handleRemove(device.terminal_id)}>
                        {m.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <p className="text-sm text-muted-foreground">{m.devices.footnote}</p>
    </div>
  )
}
