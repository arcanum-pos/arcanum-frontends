import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from 'cn'
import { useMessages, type Messages } from './i18n'
import { useGuestFacing } from '@/shared/support/guest-facing'

// The entrance screen (DOMAIN_MODEL.md "Tables and waiters", release D): the
// tables promised to guests waiting at the entrance — "Tafel 5 — even
// geduld", then "Tafel 5 — klaar" once it's cleaned, with a chime (off until
// tapped on). A paired device (a station screen with view 'tables'), or a
// window opened from the waiter screen. Customer-facing: no branding.
// `subscribe`: how this screen hears that tables changed (the device's
// socket, or the waiter screen's live channel).

const TEXTS: Messages<{ title: string; waiting: string; ready: string; table: (name: string) => string; none: string; soundOn: string; soundOff: string; soundTap: string }> = {
  nl: { title: 'Je tafel', waiting: 'even geduld', ready: 'klaar - welkom!', table: (n) => `Tafel ${n}`, none: 'Welkom! Er komt zo iemand bij je.', soundOn: 'Geluid aanzetten', soundOff: 'Geluid uitzetten', soundTap: 'Tik om het geluid aan te zetten' },
  fr: { title: 'Votre table', waiting: 'un instant', ready: 'prête - bienvenue !', table: (n) => `Table ${n}`, none: 'Bienvenue ! Quelqu’un arrive tout de suite.', soundOn: 'Activer le son', soundOff: 'Couper le son', soundTap: 'Touchez pour activer le son' },
  en: { title: 'Your table', waiting: 'just a moment', ready: 'ready - welcome!', table: (n) => `Table ${n}`, none: 'Welcome! Someone will be with you shortly.', soundOn: 'Turn sound on', soundOff: 'Turn sound off', soundTap: 'Tap to turn the sound on' },
}

interface Promised {
  name: string
  zone: string | null
  ready: boolean
  promisedAt: string
}

const SOUND_KEY = 'arcanum-entrance-sound'
const soundWanted = () => {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

function chime(ctx: AudioContext) {
  const start = ctx.currentTime
  for (const [i, freq] of [660, 880, 1046.5].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = start + i * 0.16
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.65)
  }
}

export function EntranceScreen({ orgId, subscribe }: { orgId: string; subscribe: (onChange: () => void) => () => void }) {
  useGuestFacing()
  const t = useMessages(TEXTS)
  const [list, setList] = useState<Promised[]>([])
  const [wanted, setWanted] = useState(soundWanted)
  const [audible, setAudible] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const readySeen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/promised-tables`)
      if (!res.ok) return
      const data = (await res.json()) as Promised[]
      const ready = new Set(data.filter((x) => x.ready).map((x) => x.name))
      // A table just got ready (not at opening): the chime.
      if (readySeen.current && [...ready].some((n) => !readySeen.current!.has(n)) && audio.current?.state === 'running' && soundWanted()) chime(audio.current)
      readySeen.current = ready
      setList(data)
    } catch {
      // keep what's shown
    }
  }, [orgId])

  useEffect(() => {
    load()
    const stop = subscribe(() => load())
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, subscribe])

  function toggleSound() {
    const on = !(wanted && audible)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // not remembered
    }
    setWanted(on)
    if (!on) return setAudible(false)
    audio.current ??= new AudioContext()
    audio.current.resume().then(() => {
      setAudible(audio.current!.state === 'running')
      chime(audio.current!)
    })
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground" data-testid="entrance">
      <header className="flex items-center justify-between px-8 pt-6 pb-4">
        <h1 className="text-4xl font-bold tracking-tight">{t.title}</h1>
        <button
          type="button"
          onClick={toggleSound}
          className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium', wanted && !audible ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'text-muted-foreground hover:bg-muted')}
          aria-label={wanted && audible ? t.soundOff : t.soundOn}
          data-testid="entrance-sound"
        >
          {wanted && audible ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          {wanted && !audible && t.soundTap}
        </button>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-8 pb-8">
        {list.length === 0 && <p className="text-2xl text-muted-foreground">{t.none}</p>}
        {list.map((x) => (
          <div
            key={x.name}
            className={cn('flex items-baseline justify-between gap-6 rounded-2xl px-8 py-6', x.ready ? 'animate-pulse bg-emerald-600 text-white' : 'bg-muted/60')}
            data-testid="promised"
            data-ready={x.ready ? 'true' : 'false'}
          >
            <span className="text-5xl font-bold">{t.table(x.name)}</span>
            <span className={cn('text-3xl font-semibold', x.ready ? '' : 'text-muted-foreground')}>{x.ready ? t.ready : t.waiting}</span>
          </div>
        ))}
      </main>
    </div>
  )
}
