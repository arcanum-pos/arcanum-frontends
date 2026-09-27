import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getEventSelection, setEventSelection, type EventSelection } from '@/shared/device'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { listEvents, type KassaEvent } from '../kassa/catalog-api'
import { SETTINGS_MESSAGES } from './messages'

// Which event this kassa's sales are tagged with — optional ("Geen"),
// independent of the menukaart. Goes on each new rekening; rekeningen
// already open keep theirs.
export function EventPanel({ posOrgId }: { posOrgId: string }) {
  const m = useMessages(SETTINGS_MESSAGES)
  const { locale } = useLocale()
  const [phase, setPhase] = useState<'loading' | 'failed' | 'ready'>('loading')
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
    setPhase('ready')
  }, [])

  const refresh = useCallback(() => {
    listEvents(posOrgId)
      .then(apply)
      .catch(() => setPhase('failed'))
  }, [posOrgId, apply])

  useEffect(() => {
    let cancelled = false
    listEvents(posOrgId)
      .then((list) => !cancelled && apply(list))
      .catch(() => !cancelled && setPhase('failed'))
    return () => {
      cancelled = true
    }
  }, [posOrgId, apply])

  function choose(selection: EventSelection | null) {
    setEventSelection(selection)
    refresh()
  }

  const status =
    phase === 'loading'
      ? m.eventsLoading
      : phase === 'failed'
        ? m.eventsFailed
        : events.length === 0
          ? m.eventsNone
          : selected
            ? m.activeIs(selected.name)
            : m.eventNoneActive

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {events.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{m.noEvent}</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} aria-label={selected ? m.chooseNoEvent : m.noEventActive} onClick={() => choose(null)}>
              {selected ? m.choose : m.active}
            </Button>
          </div>
          {events.map((event) => {
            const isSelected = selected?.id === event.id
            return (
              <div key={event.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  {event.name} <span className="text-muted-foreground">· {formatDate(event.date, INTL_LOCALES[locale])}</span>
                </span>
                <Button
                  size="sm"
                  variant={isSelected ? 'outline' : 'secondary'}
                  disabled={isSelected}
                  aria-label={isSelected ? m.activeNamed(event.name) : m.chooseNamed(event.name)}
                  onClick={() => choose({ id: event.id, name: event.name, date: event.date })}
                >
                  {isSelected ? m.active : m.choose}
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
          setPhase('loading')
          refresh()
        }}
      >
        {m.refresh}
      </Button>
    </div>
  )
}

// "2026-10-04" → "4 okt. 2026" (in nl-BE)
function formatDate(date: string, intlLocale: string): string {
  const d = new Date(`${date}T12:00:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric' })
}
