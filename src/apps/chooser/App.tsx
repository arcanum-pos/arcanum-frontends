import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { KioskShell } from '@/shared/kiosk-shell'
import { isLocale, storedLocale, storeLocale, useLocale, useMessages } from '@/shared/i18n'
import { appStorage, ICON_FOR_ROLE, isRole, OFFER_INSTALL_KEY, showAsDevice } from '@/shared/install'
import { isStandalone } from '@/shared/push'
import { getRegisteredTerminal, getStoredTerminalInfo, NeedsSignIn, normalizeCode, pairDevice, PAGE_FOR_ROLE, type Terminal } from '@/shared/terminal'
import { CHOOSER_MESSAGES } from './messages'

// The start page (root `/`) and the pairing page (`/pair`, the same app —
// no sign-in needed there), DOMAIN_MODEL.md "Devices: control plane and
// data plane". A station screen or customer display pairs with its code
// alone; a kassa's code asks to sign in first (and comes back here). A device is never registered by choosing a role here: only
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
//     The code this device was paired with: it just opens (an app installed
//     from the pairing link opens that link every time).
//   - `&role=&name=` (the console's link): the page is that device — its icon
//     and name — so whatever is added to a home screen or Dock from here is
//     that device (arcanum-bff sends it with that head: Safari's Add to Dock
//     reads only what was sent). In Safari (its apps get their own storage, shared/install)
//     it asks first: as an app (the steps, then it pairs in the app) or in
//     this browser.
type View =
  | { step: 'loading' }
  | { step: 'start'; removed: boolean }
  | { step: 'paired'; terminal: Terminal }
  | { step: 'replace'; terminal: Terminal; code: string }
  | { step: 'sign-in'; code: string }
  | { step: 'install'; code: string; removed: boolean }
  | { step: 'install-steps'; code: string; removed: boolean }

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
  // The device the console's link is for (`role`, `name`).
  const [device] = useState(() => {
    const role = params.get('role')
    return isRole(role) ? { role, name: params.get('name')?.trim().slice(0, 60) || m.appNames[role] } : null
  })

  // The same head as arcanum-bff sends — for a page served without it (vite preview).
  useEffect(() => {
    if (device) showAsDevice(device.role, device.name)
  }, [device])

  // The pairing link, the device included (back here after signing in).
  function link(code: string) {
    const query = new URLSearchParams({ code: code.replace(/[\s-]/g, '') })
    if (device) {
      query.set('role', device.role)
      query.set('name', device.name)
    }
    return `/pair?${query}`
  }

  // A link's code: paired right away — unless an app should do it (Safari).
  function pairOrAsk(value: string, removed = false) {
    if (!isStandalone() && device && appStorage() !== 'shared') return setView({ step: 'install', code: value, removed })
    claim(value, removed)
  }

  async function claim(value: string, removed = false) {
    if (claiming.current) return
    claiming.current = true
    setBusy(true)
    setError(null)
    try {
      const device = await pairDevice(value)
      // A new device speaks the organisation's language — unless one was picked here.
      storeLocale(storedLocale() ?? (isLocale(device.orgLocale) ? device.orgLocale : locale))
      // Chrome, Edge, Android: the screen offers to install itself.
      if (!isStandalone() && appStorage() === 'shared') {
        try {
          sessionStorage.setItem(OFFER_INSTALL_KEY, '1')
        } catch {
          // no offer
        }
      }
      window.location.href = PAGE_FOR_ROLE[device.role]
    } catch (err) {
      claiming.current = false
      setBusy(false)
      if (err instanceof NeedsSignIn) return setView({ step: 'sign-in', code: value })
      setError(err instanceof Error ? err.message : String(err))
      setView({ step: 'start', removed })
    }
  }

  useEffect(() => {
    const urlCode = params.get('code')?.trim() || ''
    const urlOrg = params.get('org')
    const stored = getStoredTerminalInfo()
    if (!stored) {
      if (urlCode) pairOrAsk(urlCode)
      else setView({ step: 'start', removed: false })
      return
    }
    // The code this device was paired with (used up): never claimed again.
    const same = !!urlCode && stored.pairedWith === normalizeCode(urlCode)
    getRegisteredTerminal(stored.role).then((terminal) => {
      if (!terminal) {
        if (urlCode && !same) pairOrAsk(urlCode, true)
        else setView({ step: 'start', removed: true })
      } else if (urlCode) {
        if (same || (urlOrg && urlOrg === terminal.orgId)) window.location.replace(PAGE_FOR_ROLE[terminal.role])
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

  // A kassa's code: someone signs in on this device first — then back here, and it pairs.
  if (view.step === 'sign-in') {
    const back = link(view.code)
    return (
      <KioskShell devicePickers>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 text-center ring-1 ring-foreground/10" data-testid="pair-sign-in">
          <h1 className="font-heading text-xl font-bold">{m.signInTitle}</h1>
          <p className="text-sm text-muted-foreground">{m.signInHint}</p>
          <Button asChild size="lg">
            <a href={`/login?returnTo=${encodeURIComponent(back)}`}>{m.signIn}</a>
          </Button>
        </section>
      </KioskShell>
    )
  }

  if ((view.step === 'install' || view.step === 'install-steps') && device) {
    const kind = appStorage()
    const steps = kind === 'mac' ? m.macSteps(device.name) : m.iosSteps(device.name)
    return (
      <KioskShell devicePickers>
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 text-center ring-1 ring-foreground/10" data-testid="install">
          <img src={`/icons/${ICON_FOR_ROLE[device.role]}-180.png`} alt="" className="mx-auto size-16 rounded-2xl" />
          <h1 className="font-heading text-xl font-bold">{device.name}</h1>
          {view.step === 'install' ? (
            <>
              <p className="text-sm">{m.installQuestion}</p>
              <Button size="lg" onClick={() => setView({ ...view, step: 'install-steps' })}>
                {m.asApp}
              </Button>
              <p className="text-xs text-muted-foreground">{m.asAppHint}</p>
              <Button variant="outline" onClick={() => claim(view.code, view.removed)} disabled={busy}>
                {busy ? m.busy : m.inBrowser}
              </Button>
            </>
          ) : (
            <>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-left text-sm" data-testid="install-steps" data-kind={kind}>
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">{m.codeValid}</p>
              <Button variant="ghost" size="sm" onClick={() => claim(view.code, view.removed)} disabled={busy}>
                {busy ? m.busy : m.inBrowserAfterAll}
              </Button>
            </>
          )}
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
