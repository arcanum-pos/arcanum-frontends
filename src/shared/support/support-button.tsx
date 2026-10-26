import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLocale, useMessages, type Messages } from '@/shared/i18n'
import { captureScreenshot } from './capture'
import { collectMetadata, signedInEmail, type SupportMetadata } from './metadata'
import { useIsGuestFacing } from './guest-facing'
import { startRecording } from './recorder'
import { SUPPORT_ORIGIN, supportFrameUrl } from './support-url'

const TEXTS: Messages<{ open: string; title: string; description: string; close: string }> = {
  nl: { open: 'Hulp, of een probleem melden', title: 'Support', description: 'Een probleem melden, een idee of een vraag.', close: 'Sluiten' },
  fr: { open: 'Aide, ou signaler un problème', title: 'Support', description: 'Signaler un problème, une idée ou une question.', close: 'Fermer' },
  en: { open: 'Help, or report a problem', title: 'Support', description: 'Report a problem, an idea or a question.', close: 'Close' },
}

// Recording starts with the page, so the errors and clicks before ? are there.
startRecording(SUPPORT_ORIGIN)

interface Context {
  screenshot: Blob | null
  metadata: SupportMetadata
  email?: string
}

// The ? on every staff screen (SUPPORT.md): hides itself, captures the
// page, collects the metadata, then opens the support form in a dialog
// (an iframe of support.kaboutersoft.be). The form says when it's ready
// and gets both by postMessage — nothing leaves the device until the user
// presses Send there, and only what the form showed them.
// `corner`: where it floats, out of the way of each screen's own buttons.
export function SupportButton({ screen, corner = 'bottom-right' }: { screen: string; corner?: 'bottom-right' | 'bottom-left' }) {
  const t = useMessages(TEXTS)
  const { locale } = useLocale()
  const [busy, setBusy] = useState(false)
  const [context, setContext] = useState<Context | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const frame = useRef<HTMLIFrameElement>(null)
  const guestFacing = useIsGuestFacing()

  async function open() {
    if (busy) return
    setBusy(true)
    // The button hides (busy) before the capture: one frame to repaint.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const [screenshot, metadata, email] = await Promise.all([captureScreenshot(), collectMetadata(screen, locale), signedInEmail()])
    setTheme(metadata.theme)
    setContext({ screenshot, metadata, email })
    setBusy(false)
  }

  useEffect(() => {
    if (!context) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SUPPORT_ORIGIN || !frame.current || e.source !== frame.current.contentWindow) return
      const type = (e.data as { type?: unknown } | null)?.type
      if (type === 'arcanum-support:ready') {
        frame.current.contentWindow!.postMessage({ type: 'arcanum-support:context', ...context }, SUPPORT_ORIGIN)
      } else if (type === 'arcanum-support:close') {
        setContext(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [context])

  return (
    <>
      {!busy && !context && !guestFacing && (
        <button
          type="button"
          data-support-ignore
          data-testid="support-button"
          aria-label={t.open}
          title={t.open}
          onClick={open}
          className={`fixed bottom-4 z-40 flex size-10 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground print:hidden ${corner === 'bottom-left' ? 'left-4' : 'right-4'}`}
        >
          <CircleHelp className="size-5" />
        </button>
      )}
      {busy && (
        <div data-support-ignore className={`fixed bottom-4 z-40 flex size-10 items-center justify-center ${corner === 'bottom-left' ? 'left-4' : 'right-4'}`} aria-hidden>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <Dialog open={!!context} onOpenChange={(o) => !o && setContext(null)}>
        <DialogContent data-support-ignore showCloseButton={false} className="h-[min(860px,calc(100svh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">{t.title}</DialogTitle>
          <DialogDescription className="sr-only">{t.description}</DialogDescription>
          {context && (
            <iframe ref={frame} src={supportFrameUrl(locale, theme)} title={t.title} data-testid="support-frame" className="size-full border-0" allow="clipboard-write" />
          )}
          <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={() => setContext(null)} aria-label={t.close}>
            <X />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
