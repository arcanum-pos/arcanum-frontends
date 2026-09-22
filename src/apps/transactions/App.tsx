import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OrgBadge } from '@/shared/org-badge'
import { formatEuro } from '@/shared/format'
import { getAllSlots, slotLabel, SLOTS_STORAGE_KEY, type Slot } from '@/shared/slots'
import { getStoredTerminalInfo } from '@/shared/terminal'

const WORKER_URL = '/api/bancontact'

interface Transaction {
  id: string
  amountCents: number
  description: string
  method: string
  items: Record<string, number>
  slotId: string | null
  deviceId: string | null
  deviceName: string | null
  userName: string | null
  userEmail: string | null
  completedAt: string
  itemType?: string
  itemCount?: number
  bonnenCount?: number
}

const METHOD_LABELS: Record<string, string> = { cash: 'Cash', sumup: 'SumUp', bancontact: 'Bancontact' }

function methodLabel(method: string): string {
  return METHOD_LABELS[method] || METHOD_LABELS.bancontact
}

function sumByMethod(transactions: Transaction[], method: string): number {
  return transactions.filter((t) => t.method === method).reduce((sum, t) => sum + t.amountCents, 0)
}

// "fietstocht" and "wandeltocht" totals combine the member and non-member
// priced variants. Same org-specific item taxonomy as kassa's own catalogue
// — ported verbatim.
const ITEM_COUNT_KEYS: Record<string, string[]> = {
  bon: ['bon'],
  fietstocht: ['fietstocht', 'fietstochtMember'],
  wandeltocht: ['wandeltocht', 'wandeltochtMember'],
}

function itemCount(tx: Transaction, type: string): number {
  if (tx.items) {
    return ITEM_COUNT_KEYS[type].reduce((sum, key) => sum + (Number.isInteger(tx.items[key]) ? tx.items[key] : 0), 0)
  }
  // Older transactions stored a single itemType/itemCount pair.
  if (tx.itemType === type && Number.isInteger(tx.itemCount)) return tx.itemCount!
  // Even older transactions (bonnen-only) stored just bonnenCount.
  if (type === 'bon' && Number.isInteger(tx.bonnenCount)) return tx.bonnenCount!
  return 0
}

function sumItemCount(transactions: Transaction[], type: string): number {
  return transactions.reduce((sum, t) => sum + itemCount(t, type), 0)
}

function sumFooiCents(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.items && Number.isInteger(t.items.fooi) ? t.items.fooi : 0), 0)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function filterBySlot(transactions: Transaction[], slotId: string): Transaction[] {
  if (slotId === 'all') return transactions
  if (slotId === 'legacy') return transactions.filter((t) => !t.slotId)
  return transactions.filter((t) => t.slotId === slotId)
}

export default function App() {
  // Reached from the admin portal (an explicit ?org= query param) or, for a
  // registered POS, falls back to that device's already-known organization.
  const [orgId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('org') || getStoredTerminalInfo()?.orgId || null)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [slots, setSlots] = useState<Slot[]>(() => getAllSlots())
  const [selectedSlot, setSelectedSlot] = useState('all')

  async function fetchTransactions(): Promise<Transaction[] | null> {
    if (!orgId) return null
    try {
      const res = await fetch(`${WORKER_URL}/transactions?orgId=${encodeURIComponent(orgId)}`)
      if (!res.ok) throw new Error(`status ${res.status}`)
      return await res.json()
    } catch (err) {
      console.error('Kon transacties niet laden', err)
      return null // null (not []) so a failed refresh doesn't wipe the last good view
    }
  }

  useEffect(() => {
    async function refresh() {
      const transactions = await fetchTransactions()
      if (transactions) setAllTransactions(transactions)
      setSlots(getAllSlots())
    }
    refresh()
    // Transactions are shared across every device, not just this browser —
    // poll periodically so the reporting page reflects sales made on other
    // terminals without needing a manual reload.
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useEffect(() => {
    // Slot definitions are per-device (localStorage) — keep the dropdown in
    // sync if they're edited in another tab.
    function onStorage(event: StorageEvent) {
      if (event.key === SLOTS_STORAGE_KEY) setSlots(getAllSlots())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const hasLegacy = allTransactions.some((t) => !t.slotId)
  const transactions = filterBySlot(allTransactions, selectedSlot)
  const totalCents = transactions.reduce((sum, t) => sum + t.amountCents, 0)
  const cashCents = sumByMethod(transactions, 'cash')
  const sumupCents = sumByMethod(transactions, 'sumup')
  const bancontactCents = totalCents - cashCents - sumupCents
  const totalBonnen = sumItemCount(transactions, 'bon')
  const totalFietstochten = sumItemCount(transactions, 'fietstocht')
  const totalWandeltochten = sumItemCount(transactions, 'wandeltocht')
  const totalFooiCents = sumFooiCents(transactions)
  const sorted = [...transactions].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <OrgBadge />

      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-lg font-semibold">Transacties</h1>
        <a href="/kassa.html" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Terug
        </a>
      </div>

      {!orgId && (
        <p className="text-sm text-destructive">
          Kon geen organisatie bepalen voor dit toestel. Open deze pagina via de kassa ("Transacties"-link) in plaats van rechtstreeks.
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <Select value={selectedSlot} onValueChange={setSelectedSlot}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tijdvak" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tijdvakken</SelectItem>
              {slots.map((slot, index) => (
                <SelectItem key={slot.id} value={slot.id}>
                  {slotLabel(slot, index)}
                </SelectItem>
              ))}
              {hasLegacy && <SelectItem value="legacy">Vóór tijdvakken</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totaal ontvangen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="font-heading text-3xl font-extrabold">{formatEuro(totalCents)}</p>
          <p className="text-sm text-muted-foreground">
            {transactions.length} geslaagde betaling{transactions.length === 1 ? '' : 'en'}
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Bancontact</p>
              <p className="text-lg font-semibold">{formatEuro(bancontactCents)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash</p>
              <p className="text-lg font-semibold">{formatEuro(cashCents)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SumUp</p>
              <p className="text-lg font-semibold">{formatEuro(sumupCents)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t pt-3 text-sm text-muted-foreground">
            <p>
              {totalBonnen} bon{totalBonnen === 1 ? '' : 'nen'} verkocht
            </p>
            <p>
              {totalFietstochten} fietstocht{totalFietstochten === 1 ? '' : 'en'} verkocht
            </p>
            <p>
              {totalWandeltochten} wandeltocht{totalWandeltochten === 1 ? '' : 'en'} verkocht
            </p>
            <p>{formatEuro(totalFooiCents)} fooi ontvangen</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alle transacties</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen transacties.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead>Methode</TableHead>
                  <TableHead>Toestel</TableHead>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Bedrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatTime(tx.completedAt)}</TableCell>
                    <TableCell>{tx.description || ''}</TableCell>
                    <TableCell>{methodLabel(tx.method)}</TableCell>
                    <TableCell>{tx.deviceName || '-'}</TableCell>
                    <TableCell>{tx.userName || tx.userEmail || '-'}</TableCell>
                    <TableCell>{formatEuro(tx.amountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
