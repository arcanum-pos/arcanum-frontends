import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getSumupReader, setSumupReader, type SumupReaderSelection } from '@/shared/device'

interface SumupReaderInfo {
  id: string
  name: string
  status: string
  model: string | null
}

// Unlike CFD/sim, a reader is never "linked" server-side — it's fetched
// live from the org's SumUp account each time, and which one this POS uses
// is a per-browser choice (see shared/device.ts's getSumupReader/setSumupReader).
export function ReaderPanel({ posOrgId }: { posOrgId: string }) {
  const [status, setStatus] = useState('Readers laden...')
  const [configured, setConfigured] = useState(true)
  const [readers, setReaders] = useState<SumupReaderInfo[]>([])
  const [selected, setSelected] = useState<SumupReaderSelection | null>(null)

  const refresh = useCallback(async () => {
    setStatus('Readers laden...')
    try {
      const res = await fetch(`/api/bancontact/sumup/readers?org_id=${encodeURIComponent(posOrgId)}`)
      const data = await res.json()

      if (!data.configured) {
        setConfigured(false)
        setStatus('SumUp cloud-API niet geconfigureerd voor deze organisatie (zie organisatie-instellingen).')
        return
      }
      if (data.error) {
        setConfigured(true)
        setStatus(`Kon readers niet ophalen: ${data.error}`)
        return
      }

      const sel = getSumupReader()
      setSelected(sel)
      setConfigured(true)
      setStatus(sel ? `Actief: ${sel.name}` : 'Geen reader geselecteerd — gebruikt simulator/bridge.')
      setReaders(data.readers || [])
    } catch {
      setStatus('Kon readers niet ophalen.')
    }
  }, [posOrgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  function choose(reader: SumupReaderSelection | null) {
    setSumupReader(reader)
    refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {configured && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>Geen reader (simulator/bridge)</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} onClick={() => choose(null)}>
              {selected ? 'Kies' : 'Actief'}
            </Button>
          </div>
          {readers.map((reader) => {
            const isSelected = selected?.id === reader.id
            return (
              <div key={reader.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  {reader.name} ({reader.status}
                  {reader.model ? `, ${reader.model}` : ''})
                </span>
                <Button size="sm" variant={isSelected ? 'outline' : 'secondary'} disabled={isSelected} onClick={() => choose({ id: reader.id, name: reader.name })}>
                  {isSelected ? 'Actief' : 'Kies'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <Button variant="ghost" size="sm" className="w-fit" onClick={refresh}>
        Vernieuwen
      </Button>
    </div>
  )
}
