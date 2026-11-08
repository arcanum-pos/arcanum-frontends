import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale, useMessages } from '@/shared/i18n'
import { addExampleMenu, createDevicePairing, getOnboarding, type Onboarding } from '../lib/api'
import { closeGettingStarted, gettingStartedOpen, isGettingStartedClosed } from '../lib/getting-started'
import { useOrg } from '../lib/org-context'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'
import { AddDeviceDialog } from './add-device-dialog'
import { pairingUrl } from './pairing-code'

// "Aan de slag" on the dashboard (lib/getting-started.ts): a menukaart (the
// example one with a click), a kassa - this browser, like the demo, or the
// device at the counter - and, optionally, a kassalade. Refreshed when the
// console gets the focus back (the kassa opens in another tab).
export function GettingStarted() {
  const m = useMessages(ADMIN_SHELL_MESSAGES).gettingStarted
  const { locale } = useLocale()
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const [status, setStatus] = useState<{ orgId: string; value: Onboarding } | null>(null)
  const [closed, setClosed] = useState<string[]>([])
  const [busy, setBusy] = useState<'menu' | 'kassa' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!orgId) return
    getOnboarding(orgId)
      .then((value) => setStatus({ orgId, value }))
      .catch(() => {})
  }, [orgId])

  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  const current = status && status.orgId === orgId ? status.value : null
  if (!orgId || !gettingStartedOpen(current, closed.includes(orgId) || isGettingStartedClosed(orgId)) || !current) return null

  async function exampleMenu() {
    setBusy('menu')
    setError(null)
    try {
      await addExampleMenu(orgId!, locale)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  // Opened before the pairing code is made: a window opened after an await
  // is a popup to most browsers.
  async function kassaHere() {
    const tab = window.open('about:blank', '_blank')
    setBusy('kassa')
    setError(null)
    try {
      const pairing = await createDevicePairing(orgId!, 'pos', m.kassaName)
      const url = pairingUrl(orgId!, pairing)
      if (tab) tab.location.href = url
      else window.location.href = url
      setNotice(m.kassaOpened)
    } catch (err) {
      tab?.close()
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const step = (done: boolean, title: string, text: string, doneText: string, actions: React.ReactNode, testId: string) => (
    <li className="flex gap-3" data-testid={testId} data-done={done}>
      {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-label={m.done} /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <div className="grid gap-2">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{done ? doneText : text}</p>
        {!done && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </li>
  )

  return (
    <Card data-testid="getting-started">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <CardTitle>{m.title}</CardTitle>
          <CardDescription>{m.intro}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={m.close}
          title={m.close}
          onClick={() => {
            closeGettingStarted(orgId)
            setClosed((c) => [...c, orgId])
          }}
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ol className="grid gap-5">
          {step(
            current.menu,
            m.menuTitle,
            m.menuText,
            m.menuDone,
            <>
              <Button onClick={exampleMenu} disabled={busy !== null}>
                {m.menuExample}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/products">{m.menuOwn}</Link>
              </Button>
            </>,
            'getting-started-menu'
          )}
          {step(
            current.kassa,
            m.kassaTitle,
            m.kassaText,
            m.kassaDone,
            <>
              <Button onClick={kassaHere} disabled={busy !== null}>
                {m.kassaHere}
              </Button>
              <AddDeviceDialog orgId={orgId} kassas={[]} onPaired={refresh} triggerLabel={m.kassaDevice} triggerVariant="outline" />
            </>,
            'getting-started-kassa'
          )}
          {step(
            current.register,
            m.registerTitle,
            m.registerText,
            m.registerDone,
            <Button variant="outline" asChild>
              <Link to="/registers">{m.registerLink}</Link>
            </Button>,
            'getting-started-register'
          )}
        </ol>
        {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}
