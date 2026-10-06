import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useMessages } from '@/shared/i18n'
import { LanguagePicker } from '@/shared/i18n/language-picker'
import { OrgBadge } from '@/shared/org-badge'
import { ThemePicker } from '@/shared/theme-picker'
import { getDevice, getDeviceId, setDeviceName } from '@/shared/device'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { LinkPanel } from './LinkPanel'
import { ReaderPanel } from './ReaderPanel'
import { CatalogPanel } from './CatalogPanel'
import { EventPanel } from './EventPanel'
import { SlotPanel } from './SlotPanel'
import { useSourceUrl } from '@/shared/source-url'
import { SETTINGS_MESSAGES } from './messages'

export default function App() {
  const m = useMessages(SETTINGS_MESSAGES)
  const sourceUrl = useSourceUrl()
  const [deviceNameInput, setDeviceNameInput] = useState(() => getDevice().name || '')
  const [deviceSaved, setDeviceSaved] = useState(false)
  const [posTerminalId, setPosTerminalId] = useState<string | null>(null)
  const [posOrgId, setPosOrgId] = useState<string | null>(null)
  const [linksChangedSignal, setLinksChangedSignal] = useState(0)

  useEffect(() => {
    let socket: ReturnType<typeof connectNotifications> | null = null

    getRegisteredTerminal('pos').then((terminal) => {
      if (!terminal) {
        window.location.replace('/')
        return
      }
      setPosTerminalId(terminal.terminalId)
      setPosOrgId(terminal.orgId)

      // A link can also change from elsewhere (e.g. kassa's "Klantscherm
      // openen" button spawning a new CFD in a second window) while this
      // page is already open in its own tab — without this, the panels
      // would just keep showing whatever they last fetched.
      socket = connectNotifications(terminal.terminalId, {
        links_changed: () => setLinksChangedSignal((n) => n + 1),
      })
    })

    return () => socket?.close()
  }, [])

  function handleSaveDeviceName() {
    setDeviceName(deviceNameInput)
    setDeviceSaved(true)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <OrgBadge />

      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-lg font-semibold">{m.title}</h1>
        <a href="/kassa.html" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {m.back}
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.thisDevice}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder={m.deviceNamePlaceholder}
            value={deviceNameInput}
            onChange={(e) => {
              setDeviceNameInput(e.target.value)
              setDeviceSaved(false)
            }}
            autoComplete="off"
          />
          <Button variant="outline" className="w-fit" onClick={handleSaveDeviceName}>
            {m.saveName}
          </Button>
          {deviceSaved && <p className="text-sm text-muted-foreground">{m.nameSaved}</p>}
          <p className="text-sm text-muted-foreground">{m.deviceId(getDeviceId())}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.language}</CardTitle>
          <p className="text-sm text-muted-foreground">{m.languageHint}</p>
        </CardHeader>
        <CardContent>
          <LanguagePicker persist />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.appearance}</CardTitle>
          <p className="text-sm text-muted-foreground">{m.appearanceHint}</p>
        </CardHeader>
        <CardContent>
          <ThemePicker withLabels />
        </CardContent>
      </Card>

      {posTerminalId && posOrgId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.catalog}</CardTitle>
              <p className="text-sm text-muted-foreground">{m.catalogHint}</p>
            </CardHeader>
            <CardContent>
              <CatalogPanel posOrgId={posOrgId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.event}</CardTitle>
              <p className="text-sm text-muted-foreground">{m.eventHint}</p>
            </CardHeader>
            <CardContent>
              <EventPanel posOrgId={posOrgId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.linkDisplay}</CardTitle>
            </CardHeader>
            <CardContent>
              <LinkPanel role="cfd" posTerminalId={posTerminalId} posOrgId={posOrgId} refreshSignal={linksChangedSignal} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reader}</CardTitle>
              <p className="text-sm text-muted-foreground">{m.readerHint}</p>
            </CardHeader>
            <CardContent>
              <ReaderPanel posOrgId={posOrgId} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="pt-6">
          <SlotPanel />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {m.freeSoftware} ·{' '}
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
          {m.sourceCode}
        </a>
      </p>
    </div>
  )
}
