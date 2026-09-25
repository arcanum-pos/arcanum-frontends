import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { OrgBadge } from '@/shared/org-badge'
import { getDevice, getDeviceId, setDeviceName } from '@/shared/device'
import { connectNotifications, getRegisteredTerminal } from '@/shared/terminal'
import { LinkPanel } from './LinkPanel'
import { ReaderPanel } from './ReaderPanel'
import { CatalogPanel } from './CatalogPanel'
import { SlotPanel } from './SlotPanel'

export default function App() {
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
        <h1 className="text-lg font-semibold">Instellingen</h1>
        <a href="/kassa.html" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Terug
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dit toestel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder="bv. Kassa 1"
            value={deviceNameInput}
            onChange={(e) => {
              setDeviceNameInput(e.target.value)
              setDeviceSaved(false)
            }}
            autoComplete="off"
          />
          <Button variant="outline" className="w-fit" onClick={handleSaveDeviceName}>
            Naam opslaan
          </Button>
          {deviceSaved && <p className="text-sm text-muted-foreground">Naam van dit toestel opgeslagen.</p>}
          <p className="text-sm text-muted-foreground">Toestel-ID: {getDeviceId()}</p>
        </CardContent>
      </Card>

      {posTerminalId && posOrgId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Menukaart</CardTitle>
              <p className="text-sm text-muted-foreground">Welke menukaart deze kassa verkoopt.</p>
            </CardHeader>
            <CardContent>
              <CatalogPanel posOrgId={posOrgId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Klantscherm koppelen</CardTitle>
            </CardHeader>
            <CardContent>
              <LinkPanel role="cfd" posTerminalId={posTerminalId} posOrgId={posOrgId} refreshSignal={linksChangedSignal} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SumUp-simulator koppelen</CardTitle>
              <p className="text-sm text-muted-foreground">Voor test zonder echte SumUp-reader.</p>
            </CardHeader>
            <CardContent>
              <LinkPanel role="sim" posTerminalId={posTerminalId} posOrgId={posOrgId} refreshSignal={linksChangedSignal} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SumUp Solo-reader</CardTitle>
              <p className="text-sm text-muted-foreground">
                Echte reader gekoppeld aan je SumUp-account. Betalingen gaan dan via de SumUp cloud-API (polling, nog geen callback).
              </p>
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
    </div>
  )
}
