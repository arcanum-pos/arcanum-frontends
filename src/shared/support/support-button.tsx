import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'
import { useLocale, useMessages, type Messages } from '@/shared/i18n'
import { captureScreenshot } from './capture'
import { collectMetadata, signedInEmail, type SupportMetadata } from './metadata'
import { startRecording } from './recorder'
import { SUPPORT_ORIGIN, supportFrameUrl } from './support-url'

const TEXTS: Messages<{ open: string; label: string; title: string; description: string; close: string }> = {
  nl: { open: 'Hulp, of een probleem melden', label: 'Hulp', title: 'Support', description: 'Een probleem melden, een idee of een vraag.', close: 'Sluiten' },
  fr: { open: 'Aide, ou signaler un problème', label: 'Aide', title: 'Support', description: 'Signaler un problème, une idée ou une question.', close: 'Fermer' },
  en: { open: 'Help, or report a problem', label: 'Help', title: 'Support', description: 'Report a problem, an idea or a question.', close: 'Close' },
}

// Recording starts with the page, so the errors and clicks before ? are there.
startRecording(SUPPORT_ORIGIN)

interface Context {
  screenshot: Blob | null
  metadata: SupportMetadata
  email?: string
}

// The ? on every staff screen (SUPPORT.md), always the last thing in the
// screen's header, top right: captures the page (without itself),
// collects the metadata, then opens the support form in a dialog (an
// iframe of support.kaboutersoft.be). The form says when it's ready and
// gets both by postMessage — nothing leaves the device until the user
// presses Send there, and only what the form showed them.
// `labelled`: icon over a word, like the kassa's other header buttons.
export function SupportButton({ screen, labelled = false, className }: { screen: string; labelled?: boolean; className?: string }) {
  const t = useMessages(TEXTS)
  const { locale } = useLocale()
  const [busy, setBusy] = useState(false)
  const [context, setContext] = useState<Context | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const frame = useRef<HTMLIFrameElement>(null)

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
      <button
        type="button"
        data-support-ignore
        data-testid="support-button"
        aria-label={t.open}
        title={t.open}
        onClick={open}
        disabled={busy}
        className={cn(
          'flex shrink-0 items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden',
          labelled ? 'h-[52px] min-w-[60px] flex-col gap-1 rounded-[10px] px-1.5 text-[11px] font-medium [&_svg]:size-[21px] [&_svg]:stroke-[1.7]' : 'size-9 rounded-full [&_svg]:size-5',
          className
        )}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CircleHelp />}
        {labelled && <span className="whitespace-nowrap">{t.label}</span>}
      </button>
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
