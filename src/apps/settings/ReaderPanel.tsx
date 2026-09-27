import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getSumupReader, setSumupReader, type SumupReaderSelection } from '@/shared/device'
import { useMessages } from '@/shared/i18n'
import { SETTINGS_MESSAGES } from './messages'

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
  const m = useMessages(SETTINGS_MESSAGES)
  const [phase, setPhase] = useState<{ kind: 'loading' | 'notConfigured' | 'ready' } | { kind: 'failed'; error: string | null }>({ kind: 'loading' })
  const [configured, setConfigured] = useState(true)
  const [readers, setReaders] = useState<SumupReaderInfo[]>([])
  const [selected, setSelected] = useState<SumupReaderSelection | null>(null)

  const refresh = useCallback(async () => {
    setPhase({ kind: 'loading' })
    try {
      const res = await fetch(`/api/bancontact/sumup/readers?org_id=${encodeURIComponent(posOrgId)}`)
      const data = await res.json()

      if (!data.configured) {
        setConfigured(false)
        setPhase({ kind: 'notConfigured' })
        return
      }
      if (data.error) {
        setConfigured(true)
        setPhase({ kind: 'failed', error: String(data.error) })
        return
      }

      const sel = getSumupReader()
      setSelected(sel)
      setConfigured(true)
      setPhase({ kind: 'ready' })
      setReaders(data.readers || [])
    } catch {
      setPhase({ kind: 'failed', error: null })
    }
  }, [posOrgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  function choose(reader: SumupReaderSelection | null) {
    setSumupReader(reader)
    refresh()
  }

  const status =
    phase.kind === 'loading'
      ? m.readersLoading
      : phase.kind === 'notConfigured'
        ? m.readersNotConfigured
        : phase.kind === 'failed'
          ? phase.error
            ? m.readersFailedWith(phase.error)
            : m.readersFailed
          : selected
            ? m.activeIs(selected.name)
            : m.readerNoneSelected

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {configured && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{m.noReader}</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} onClick={() => choose(null)}>
              {selected ? m.choose : m.active}
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
                  {isSelected ? m.active : m.choose}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <Button variant="ghost" size="sm" className="w-fit" onClick={refresh}>
        {m.refresh}
      </Button>
    </div>
  )
}
