import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getEventSelection, setEventSelection, type EventSelection } from '@/shared/device'
import { listEvents, type KassaEvent } from '../kassa/catalog-api'

// Which event this kassa's sales are tagged with — optional ("Geen"),
// independent of the menukaart. Goes on each new rekening; rekeningen
// already open keep theirs.
export function EventPanel({ posOrgId }: { posOrgId: string }) {
  const [status, setStatus] = useState('Evenementen laden...')
  const [events, setEvents] = useState<KassaEvent[]>([])
  const [selected, setSelected] = useState<EventSelection | null>(null)

  const apply = useCallback((list: KassaEvent[]) => {
    let sel = getEventSelection()
    // Gone from the org's list: forget it rather than tag sales with it.
    if (sel && !list.some((e) => e.id === sel!.id)) {
      setEventSelection(null)
      sel = null
    }
    setEvents(list)
    setSelected(sel)
    if (list.length === 0) setStatus('Nog geen evenementen — een beheerder maakt ze aan in de console (Evenementen).')
    else setStatus(sel ? `Actief: ${sel.name}` : 'Geen evenement — verkopen worden niet aan een evenement gekoppeld.')
  }, [])

  const refresh = useCallback(() => {
    listEvents(posOrgId)
      .then(apply)
      .catch(() => setStatus('Kon evenementen niet ophalen.'))
  }, [posOrgId, apply])

  useEffect(() => {
    let cancelled = false
    listEvents(posOrgId)
      .then((list) => !cancelled && apply(list))
      .catch(() => !cancelled && setStatus('Kon evenementen niet ophalen.'))
    return () => {
      cancelled = true
    }
  }, [posOrgId, apply])

  function choose(selection: EventSelection | null) {
    setEventSelection(selection)
    refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {events.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>Geen evenement</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} aria-label={selected ? 'Kies geen evenement' : 'Geen evenement actief'} onClick={() => choose(null)}>
              {selected ? 'Kies' : 'Actief'}
            </Button>
          </div>
          {events.map((event) => {
            const isSelected = selected?.id === event.id
            return (
              <div key={event.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  {event.name} <span className="text-muted-foreground">· {formatDate(event.date)}</span>
                </span>
                <Button
                  size="sm"
                  variant={isSelected ? 'outline' : 'secondary'}
                  disabled={isSelected}
                  aria-label={isSelected ? `${event.name} actief` : `Kies ${event.name}`}
                  onClick={() => choose({ id: event.id, name: event.name, date: event.date })}
                >
                  {isSelected ? 'Actief' : 'Kies'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => {
          setStatus('Evenementen laden...')
          refresh()
        }}
      >
        Vernieuwen
      </Button>
    </div>
  )
}

// "2026-10-04" → "4 okt. 2026"
function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}
