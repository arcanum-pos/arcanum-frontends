import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { listOrgDevices, listSumupReaders, removeDevice, type DeviceRole, type SumupReader } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'

const ROLE_LABELS: Record<DeviceRole, string> = {
  pos: 'Kassa',
  cfd: 'Klantscherm',
  sim: 'SumUp-simulator',
}

const READER_MODEL_LABELS: Record<string, string> = {
  solo: 'SumUp Solo',
  'virtual-solo': 'SumUp Virtual Solo',
}

const READER_STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  paired: { label: 'Gekoppeld', variant: 'default' },
  processing: { label: 'Bezig', variant: 'outline' },
  expired: { label: 'Verlopen', variant: 'destructive' },
  unknown: { label: 'Onbekend', variant: 'secondary' },
}

export default function DevicesPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: devices, loading, error, reload } = useAsync(
    () => (orgId ? listOrgDevices(orgId) : Promise.resolve([])),
    [orgId]
  )
  // Fetched live from SumUp, not stored by us — read-only here on purpose:
  // pairing/unpairing a reader happens in the SumUp app or Instellingen, not
  // this list.
  const { data: sumupReaders, error: sumupError } = useAsync(
    () =>
      orgId
        ? listSumupReaders(orgId)
        : Promise.resolve({ configured: false, readers: [] as SumupReader[], error: undefined as string | undefined }),
    [orgId]
  )

  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(terminalId: string) {
    if (!window.confirm(`Toestel ${terminalId} verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">
          Alle kassa's, klantschermen, simulatoren en SumUp-readers gekoppeld aan {currentOrg?.name ?? 'deze organisatie'}.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Kon toestellen niet laden: {error}</p>}
      {(sumupError || sumupReaders?.error) && (
        <p className="text-sm text-destructive">Kon SumUp-readers niet ophalen: {sumupError ?? sumupReaders?.error}</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Toestel-ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Gekoppeld aan</TableHead>
            <TableHead>Geregistreerd op</TableHead>
            <TableHead>Status</TableHead>
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
                Nog geen toestellen geregistreerd voor deze organisatie.
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            sumupReaders?.readers.map((reader) => {
              const status = READER_STATUS_BADGE[reader.status] ?? READER_STATUS_BADGE.unknown
              return (
                <TableRow key={`sumup-${reader.id}`}>
                  <TableCell>
                    <div className="font-medium">{reader.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{reader.id}</div>
                  </TableCell>
                  <TableCell>{(reader.model && READER_MODEL_LABELS[reader.model]) ?? 'SumUp-reader'}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )
            })}
          {!loading &&
            devices?.map((device) => (
              <TableRow key={device.terminal_id}>
                <TableCell className="font-mono text-xs">{device.terminal_id}</TableCell>
                <TableCell>{ROLE_LABELS[device.role] ?? device.role}</TableCell>
                <TableCell className="font-mono text-xs">{device.linked_to ?? '—'}</TableCell>
                <TableCell>{new Date(device.created_at).toLocaleString('nl-BE')}</TableCell>
                <TableCell>
                  <Badge variant={device.online ? 'default' : 'secondary'}>
                    {device.online ? 'Online' : 'Offline'}
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
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Offline betekent enkel dat er nu geen live verbinding is (bv. het scherm staat uit of de kassa toont een
        andere pagina) — het toestel en zijn koppeling blijven bestaan. Gebruik "Verwijderen" enkel voor toestellen
        die echt niet meer gebruikt worden. SumUp-readers staan hier enkel ter info (live opgehaald uit je SumUp-account)
        — koppelen of loskoppelen doe je in de SumUp-app of in Instellingen, niet hier.
      </p>
    </div>
  )
}
