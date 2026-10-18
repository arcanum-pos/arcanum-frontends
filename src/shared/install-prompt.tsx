import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages, type Messages } from './i18n'
import { OFFER_INSTALL_KEY } from './install'

const TEXTS: Messages<{ title: string; hint: string; install: string; close: string }> = {
  nl: { title: 'Installeer als app', hint: 'Met een eigen icoon, en het opent altijd meteen dit scherm.', install: 'Installeren', close: 'Sluiten' },
  fr: { title: 'Installer comme app', hint: 'Avec sa propre icône, et il ouvre toujours directement cet écran.', install: 'Installer', close: 'Fermer' },
  en: { title: 'Install as an app', hint: 'With its own icon, and it always opens straight to this screen.', install: 'Install', close: 'Close' },
}

// Chrome's (Edge's, Android's) install event — not in TypeScript's DOM types.
interface InstallEvent extends Event {
  prompt(): Promise<void>
}

const offered = () => {
  try {
    return sessionStorage.getItem(OFFER_INSTALL_KEY) === '1'
  } catch {
    return false
  }
}

const done = () => {
  try {
    sessionStorage.removeItem(OFFER_INSTALL_KEY)
  } catch {
    // nothing kept
  }
}

// A device screen just paired in a browser whose installed apps share its
// storage (shared/install): "Installeer als app", once — only when the
// browser can install it (it fires beforeinstallprompt; Safari never does,
// there the app is installed before pairing).
export function InstallPrompt() {
  const t = useMessages(TEXTS)
  const [event, setEvent] = useState<InstallEvent | null>(null)
  useEffect(() => {
    if (!offered()) return
    const keep = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', keep)
    return () => window.removeEventListener('beforeinstallprompt', keep)
  }, [])
  if (!event) return null
  const close = () => {
    done()
    setEvent(null)
  }
  return (
    <div role="dialog" aria-label={t.title} data-testid="install-prompt" className="fixed right-4 bottom-4 z-50 flex max-w-xs items-start gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-lg ring-1 ring-foreground/10">
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{t.title}</p>
        <p className="text-sm text-muted-foreground">{t.hint}</p>
        <Button
          size="sm"
          className="self-start"
          onClick={async () => {
            await event.prompt().catch(() => {})
            close()
          }}
        >
          <Download />
          {t.install}
        </Button>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={t.close} onClick={close}>
        <X />
      </Button>
    </div>
  )
}
