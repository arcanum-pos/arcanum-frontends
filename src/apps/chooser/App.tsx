import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { KioskShell } from '@/shared/kiosk-shell'
import { isLocale, storedLocale, storeLocale, useLocale, useMessages } from '@/shared/i18n'
import { claimPairingCode, getRegisteredTerminal, getStoredTerminalInfo, PAGE_FOR_ROLE, type Terminal } from '@/shared/terminal'
import { CHOOSER_MESSAGES } from './messages'

// The start page (root `/`, DOMAIN_MODEL.md "Devices: control plane and
// data plane"). A device is never registered by choosing a role here: only
// with a pairing code an admin made in the console (Toestellen → Toestel
// toevoegen). So:
//   - a paired device opens its screen right away (a kiosk);
//   - otherwise: "Dit toestel koppelen" (the code — the console's QR opens
//     this page with ?code= filled in) or "Beheer" (the console).
//   - `?start`: a paired device shows itself instead, with "Openen".
//   - `?code=` (the console's QR, a demo — the bootstrapper adds `&org=`):
//     pairs right away, no click. Unless this browser already is a device
//     that still exists: the same org's (`org`, a demo's second click) just
//     opens; another org's asks first — a real kassa isn't replaced unseen.
type View =
  | { step: 'loading' }
  | { step: 'start'; removed: boolean }
  | { step: 'paired'; terminal: Terminal }
  | { step: 'replace'; terminal: Terminal; code: string }

export default function App() {
  const m = useMessages(CHOOSER_MESSAGES)
  const { locale } = useLocale()
  const params = new URLSearchParams(window.location.search)
  const [view, setView] = useState<View>({ step: 'loading' })
  const [code, setCode] = useState(() => params.get('code') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A code is single use: claim it once, also when React runs the effect twice.
  const claiming = useRef(false)

  async function claim(value: string, removed = false) {
    if (claiming.current) return
    claiming.current = true
    setBusy(true)
    setError(null)
    try {
      const device = await claimPairingCode(value)
      // A new device speaks the organisation's language — unless one was picked here.
      storeLocale(storedLocale() ?? (isLocale(device.orgLocale) ? device.orgLocale : locale))
      window.location.href = PAGE_FOR_ROLE[device.role]
    } catch (err) {
      claiming.current = false
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
      setView({ step: 'start', removed })
    }
  }

  useEffect(() => {
    const urlCode = params.get('code')?.trim() || ''
    const urlOrg = params.get('org')
    const stored = getStoredTerminalInfo()
    if (!stored) {
      if (urlCode) claim(urlCode)
      else setView({ step: 'start', removed: false })
      return
    }
    getRegisteredTerminal(stored.role).then((terminal) => {
      if (!terminal) {
        if (urlCode) claim(urlCode, true)
        else setView({ step: 'start', removed: true })
      } else if (urlCode) {
        if (urlOrg && urlOrg === terminal.orgId) window.location.replace(PAGE_FOR_ROLE[terminal.role])
        else setView({ step: 'replace', terminal, code: urlCode })
      } else if (params.has('start')) setView({ step: 'paired', terminal })
      else window.location.replace(PAGE_FOR_ROLE[terminal.role])
    })
    // Once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pair(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim()) claim(code)
  }

  if (view.step === 'loading') {
    return (
      <KioskShell devicePickers>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </KioskShell>
    )
  }

  if (view.step === 'replace') {
    const { terminal } = view
    const name = terminal.name || m.roles[terminal.role]
    return (
      <KioskShell devicePickers>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 text-center ring-1 ring-foreground/10" data-testid="replace">
          <h1 className="font-heading text-xl font-bold">{m.pairedTitle(name)}</h1>
          {terminal.orgName && <p className="text-sm text-muted-foreground">{m.org(terminal.orgName)}</p>}
          <p className="text-sm">{m.replaceHint}</p>
          <Button onClick={() => claim(view.code)} disabled={busy}>
            {busy ? m.busy : m.replaceYes}
          </Button>
          <Button variant="outline" onClick={() => window.location.replace(PAGE_FOR_ROLE[terminal.role])}>
            {m.replaceNo(name)}
          </Button>
        </section>
      </KioskShell>
    )
  }

  if (view.step === 'paired') {
    const { terminal } = view
    return (
      <KioskShell devicePickers>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 text-center ring-1 ring-foreground/10" data-testid="paired">
          <h1 className="font-heading text-xl font-bold">{m.pairedTitle(terminal.name || m.roles[terminal.role])}</h1>
          {terminal.orgName && <p className="text-sm text-muted-foreground">{m.org(terminal.orgName)}</p>}
          <Button onClick={() => window.location.replace(PAGE_FOR_ROLE[terminal.role])}>{m.open}</Button>
        </section>
      </KioskShell>
    )
  }

  return (
    <KioskShell devicePickers>
      <div className="flex flex-col gap-4">
        <h1 className="text-center font-heading text-xl font-bold">{m.title}</h1>
        {view.removed && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{m.removed}</p>}

        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10" data-testid="pair">
          <div>
            <h2 className="font-heading text-base font-semibold">{m.pairTitle}</h2>
            <p className="text-sm text-muted-foreground">{m.pairHint}</p>
          </div>
          <form className="flex flex-col gap-2" onSubmit={pair}>
            <label htmlFor="pairing-code" className="sr-only">
              {m.code}
            </label>
            <Input
              id="pairing-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-12 text-center font-mono text-xl tracking-widest uppercase"
              aria-label={m.code}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy || !code.trim()}>
              {busy ? m.busy : m.pair}
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10" data-testid="manage">
          <div>
            <h2 className="font-heading text-base font-semibold">{m.manageTitle}</h2>
            <p className="text-sm text-muted-foreground">{m.manageHint}</p>
          </div>
          <Button variant="outline" asChild>
            <a href="/console">{m.manage}</a>
          </Button>
        </section>
      </div>
    </KioskShell>
  )
}
