import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages, type Messages } from './i18n'
import { browserFor, MANUAL_AFTER_MS, OFFER_INSTALL_KEY, type InstallMenu } from './install'

const TEXTS: Messages<{ title: string; hint: string; install: string; close: string; steps: Record<InstallMenu, string> }> = {
  nl: {
    title: 'Installeer als app',
    hint: 'Met een eigen icoon, en het opent altijd meteen dit scherm.',
    install: 'Installeren',
    close: 'Sluiten',
    steps: {
      edge: 'Open het menu ⋯ rechtsboven, dan Apps en kies Installeren.',
      chrome: 'Open het menu ⋮ rechtsboven en kies de optie om deze pagina als app te installeren.',
      android: "Open het menu ⋮ en kies 'App installeren' of 'Toevoegen aan startscherm'.",
    },
  },
  fr: {
    title: 'Installer comme app',
    hint: 'Avec sa propre icône, et il ouvre toujours directement cet écran.',
    install: 'Installer',
    close: 'Fermer',
    steps: {
      edge: 'Ouvrez le menu ⋯ en haut à droite, puis Applications et choisissez Installer.',
      chrome: "Ouvrez le menu ⋮ en haut à droite et choisissez l'option pour installer cette page comme app.",
      android: "Ouvrez le menu ⋮ et choisissez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'.",
    },
  },
  en: {
    title: 'Install as an app',
    hint: 'With its own icon, and it always opens straight to this screen.',
    install: 'Install',
    close: 'Close',
    steps: {
      edge: 'Open the ⋯ menu at the top right, then Apps, and choose Install.',
      chrome: 'Open the ⋮ menu at the top right and choose the option to install this page as an app.',
      android: "Open the ⋮ menu and choose 'Install app' or 'Add to Home screen'.",
    },
  },
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

// Caught from the moment this module loads, before React has drawn the
// screen: the browser may say it can install the page that early.
let caught: InstallEvent | null = null
const watchers = new Set<() => void>()
const changed = () => watchers.forEach((w) => w())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    if (!offered()) return
    e.preventDefault()
    caught = e as InstallEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    done()
    caught = null
    changed()
  })
}
const subscribe = (watcher: () => void) => {
  watchers.add(watcher)
  return () => void watchers.delete(watcher)
}

// A device screen just paired in a browser whose installed apps share its
// storage (shared/install): "Installeer als app", once. With the browser's
// own install when it offers one (beforeinstallprompt; Safari never does,
// there the app is installed before pairing), else after a while the steps
// in its menu.
export function InstallPrompt() {
  const t = useMessages(TEXTS)
  const event = useSyncExternalStore(subscribe, () => caught)
  const [open, setOpen] = useState(offered)
  const [manual, setManual] = useState(false)
  const browser = browserFor(navigator.userAgent)
  useEffect(() => {
    if (!open || !browser) return
    const timer = window.setTimeout(() => setManual(true), MANUAL_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [open, browser])
  // Installed meanwhile (appinstalled): no longer offered.
  if (!open || !offered() || (!event && !(manual && browser))) return null
  const close = () => {
    done()
    caught = null
    setOpen(false)
  }
  return (
    <div role="dialog" aria-label={t.title} data-testid="install-prompt" className="fixed right-4 bottom-4 z-50 flex max-w-xs items-start gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-lg ring-1 ring-foreground/10">
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{t.title}</p>
        <p className="text-sm text-muted-foreground">{t.hint}</p>
        {event ? (
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
        ) : (
          <p className="text-sm" data-testid="install-steps">
            {t.steps[browser!]}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={t.close} onClick={close}>
        <X />
      </Button>
    </div>
  )
}
