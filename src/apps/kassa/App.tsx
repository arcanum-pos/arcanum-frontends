import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppBrand } from '@/shared/app-brand'
import { OrgBadge } from '@/shared/org-badge'
import { getDeviceId, getDeviceName, getSumupReader } from '@/shared/device'
import {
  connectNotifications,
  getLinkedDevice,
  getRegisteredTerminal,
  linkTerminals,
  registerRemoteTerminal,
  unlinkTerminal,
} from '@/shared/terminal'
import { getCurrentSlotId } from '@/shared/slots'
import {
  addToDraft,
  DEFAULT_PRICING,
  isPaymentResolved,
  MANUAL_METHOD_LABELS,
  tabBreakdownLines,
  type CurrentPayment,
  type PaymentMethod,
  type PickerItem,
  type Pricing,
} from './lib'
import { ItemPicker } from './ItemPicker'
import { PaymentStatus } from './PaymentStatus'
import { NameDialog, VoidDialog } from './TabDialogs'
import { TabPanel } from './TabPanel'
import { QUICK_SALE_LABEL, TabStrip, type ActiveKey } from './TabStrip'
import * as tabsApi from './tabs-api'
import { TabApiError, tabTitle, type DraftLine, type TabDetail, type TabLine, type TabSummary } from './tabs-api'

const WORKER_URL = '/api/bancontact'
const DEVICES_URL = '/api/devices'

type NameDialogMode = 'new' | 'park' | 'rename'

// Every sale goes through a tab (DOMAIN_MODEL.md: "a counter sale is a tab
// that is paid immediately"). The Toog button is a local draft that becomes
// a brand-new tab only when paid or parked; named tabs live on the server
// and are shared by every kassa of the org. No live sync between kassas yet
// — the open-tab list reloads on focus, on switching and after every
// action, and the server refuses anything based on a stale view (409).
export default function App() {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bancontact')
  const [current, setCurrent] = useState<CurrentPayment | null>(null)
  const [manualStatusText, setManualStatusText] = useState('')
  const [countdownText, setCountdownText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [terminalIdLabel, setTerminalIdLabel] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [openingDisplay, setOpeningDisplay] = useState(false)

  const [orgId, setOrgId] = useState<string | null>(null)
  const [tabs, setTabs] = useState<TabSummary[]>([])
  const [active, setActive] = useState<ActiveKey>('quick')
  const [activeTab, setActiveTab] = useState<TabDetail | null>(null)
  // Unsubmitted lines per tab ('quick' = the Toog draft), kept per tab so
  // switching away and back doesn't lose them. Local to this kassa only.
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({})
  const [nameDialog, setNameDialog] = useState<NameDialogMode | null>(null)
  const [voidTarget, setVoidTarget] = useState<TabLine | null>(null)

  const currentRef = useRef<CurrentPayment | null>(null)
  const activeRef = useRef<ActiveKey>('quick')
  activeRef.current = active
  const posTerminalIdRef = useRef<string | null>(null)
  const posOrgIdRef = useRef<string | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const displayWindowRef = useRef<Window | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const draft = drafts[active] || []
  // Only the tab that's actually selected — never a previous one still in
  // state while the new one loads.
  const shownTab = active !== 'quick' && activeTab?.id === active ? activeTab : null
  const tabLoading = active !== 'quick' && !shownTab

  function setCurrentBoth(value: CurrentPayment | null) {
    currentRef.current = value
    setCurrent(value)
  }

  function broadcastCurrent() {
    const c = currentRef.current
    channelRef.current?.postMessage(c ? { type: 'payment', ...c } : { type: 'reset' })
  }

  function stopCountdown() {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = null
    setCountdownText('')
  }

  function startCountdown(expiresAt: string) {
    stopCountdown()
    const expiryTime = new Date(expiresAt).getTime()
    countdownTimerRef.current = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((expiryTime - Date.now()) / 1000))
      setCountdownText(secondsLeft > 0 ? `Vervalt over ${secondsLeft}s` : 'Verlopen')
      if (secondsLeft <= 0 && countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }, 1000)
  }

  // --- Tabs ---

  function setDraftFor(key: ActiveKey, lines: DraftLine[]) {
    setDrafts((prev) => {
      const next = { ...prev }
      if (lines.length > 0) next[key] = lines
      else delete next[key]
      return next
    })
  }

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : String(err))
    // A 409 means this kassa's view was stale — pull the current state.
    if (err instanceof TabApiError && err.status === 409) refreshAll()
  }

  async function refreshTabs(): Promise<TabSummary[] | null> {
    const org = posOrgIdRef.current
    if (!org) return null
    try {
      const list = await tabsApi.listOpenTabs(org)
      setTabs(list)
      return list
    } catch (err) {
      console.error('Kon open rekeningen niet laden', err)
      return null
    }
  }

  async function loadTab(key: ActiveKey) {
    const org = posOrgIdRef.current
    if (!org || key === 'quick') {
      setActiveTab(null)
      return
    }
    try {
      const tab = await tabsApi.getTab(org, key)
      // Ignore a slow response for a tab the cashier already switched away from.
      if (activeRef.current === key) setActiveTab(tab)
    } catch (err) {
      showError(err)
    }
  }

  // Also notices a tab that was closed or cancelled on another kassa in the
  // meantime and falls back to Toog.
  async function refreshAll() {
    const list = await refreshTabs()
    const key = activeRef.current
    if (list && key !== 'quick' && !list.some((t) => t.id === key) && !currentRef.current) {
      setError('Deze rekening is intussen afgesloten, mogelijk op een andere kassa.')
      setDraftFor(key, [])
      selectTab('quick')
      return
    }
    await loadTab(key)
  }

  function selectTab(key: ActiveKey) {
    setActive(key)
    activeRef.current = key
    setActiveTab(null)
    loadTab(key)
    refreshTabs()
  }

  function addItem(item: PickerItem, quantity: number) {
    setError('')
    setDraftFor(active, addToDraft(draft, item, quantity))
  }

  function setDraftQuantity(index: number, quantity: number) {
    const next = [...draft]
    if (quantity <= 0) next.splice(index, 1)
    else next[index] = { ...next[index], quantity }
    setDraftFor(active, next)
  }

  async function runTabAction(action: (org: string) => Promise<void>) {
    const org = posOrgIdRef.current
    if (!org) {
      setError('Organisatie van dit toestel nog niet bekend.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await action(org)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  function submitOrder() {
    if (active === 'quick' || draft.length === 0) return
    const key = active
    runTabAction(async (org) => {
      setActiveTab(await tabsApi.addOrder(org, key, draft))
      setDraftFor(key, [])
      refreshTabs()
    })
  }

  function confirmNameDialog(name: string) {
    const mode = nameDialog
    setNameDialog(null)
    runTabAction(async (org) => {
      if (mode === 'rename' && shownTab) {
        setActiveTab(await tabsApi.renameTab(org, shownTab.id, name))
        refreshTabs()
        return
      }
      // 'park' moves the Toog draft onto a new named tab as its first order.
      const lines = mode === 'park' ? drafts.quick || [] : []
      const tab = await tabsApi.createTab(org, name, getCurrentSlotId(), lines)
      if (mode === 'park') setDraftFor('quick', [])
      await refreshTabs()
      setActive(tab.id)
      activeRef.current = tab.id
      setActiveTab(tab)
    })
  }

  function confirmVoid(line: TabLine, reason: string, quantity: number) {
    setVoidTarget(null)
    if (!shownTab) return
    const tabId = shownTab.id
    runTabAction(async (org) => {
      setActiveTab(await tabsApi.voidLine(org, tabId, line.id, reason, quantity))
      refreshTabs()
    })
  }

  function cancelEmptyTab() {
    if (!shownTab) return
    const tabId = shownTab.id
    runTabAction(async (org) => {
      await tabsApi.cancelTab(org, tabId)
      selectTab('quick')
    })
  }

  // --- Payment ---

  // Submits whatever's still in the draft first (for Toog: creates the tab
  // with it), then charges exactly what's outstanding — the server refuses
  // any other amount.
  function pay() {
    const key = active
    runTabAction(async (org) => {
      let tab: TabDetail
      if (key === 'quick') {
        tab = await tabsApi.createTab(org, QUICK_SALE_LABEL, getCurrentSlotId(), draft)
        setDraftFor('quick', [])
        // From here on it's a real tab: if the payment fails or is
        // cancelled, it stays open in the strip to retry, void or close.
        setActive(tab.id)
        activeRef.current = tab.id
      } else if (draft.length > 0) {
        tab = await tabsApi.addOrder(org, key, draft)
        setDraftFor(key, [])
      } else {
        tab = await tabsApi.getTab(org, key)
      }
      setActiveTab(tab)
      refreshTabs()

      if (tab.outstandingCents < 1) {
        setError('Niets te betalen op deze rekening.')
        return
      }
      await startCharge(org, tab)
    })
  }

  async function startCharge(org: string, tab: TabDetail) {
    const amountCents = tab.outstandingCents
    const breakdown = tabBreakdownLines(tab)
    const common = {
      amount: amountCents,
      orgId: org,
      tabId: tab.id,
      posTerminalId: posTerminalIdRef.current || undefined,
      slotId: getCurrentSlotId(),
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
    }

    if (paymentMethod === 'bancontact') {
      const res = await fetch(`${WORKER_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(common),
      })
      const data = await res.json()
      if (!res.ok) throw new TabApiError(data.error ? `${data.error}${data.details ? `: ${JSON.stringify(data.details)}` : ''}` : 'Onbekende fout', res.status)

      setCurrentBoth({
        method: 'bancontact',
        chargeId: data.chargeId,
        tabId: tab.id,
        qrCodeUrl: data.qrCodeUrl,
        expiresAt: data.expiresAt,
        status: data.status,
        amountCents: data.amount,
        breakdown,
      })
      broadcastCurrent()
      startCountdown(data.expiresAt)
      checkBancontactStatus(data.chargeId) // one immediate check, in case it resolves before the push arrives
      return
    }

    // Cash and SumUp are both "manual confirm" flows: the cashier collects
    // payment outside the app (or the linked reader resolves it) and
    // confirms here so it's recorded under the right method.
    const method = paymentMethod
    const readerId = method === 'sumup' ? getSumupReader()?.id : undefined
    const res = await fetch(`${WORKER_URL}/sumup/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...common, method, readerId }),
    })
    const data = await res.json()
    if (!res.ok || !data.chargeId) throw new TabApiError(data.error || 'Kon betaling niet registreren', res.status)

    setCurrentBoth({
      method,
      status: 'AWAITING_MANUAL',
      chargeId: data.chargeId,
      tabId: tab.id,
      amountCents,
      breakdown,
      dispatchedToReader: !!readerId,
    })
    setManualStatusText(MANUAL_METHOD_LABELS[method].waiting)
    broadcastCurrent()
    if (method === 'sumup') checkSumupStatus(data.chargeId)
  }

  async function checkBancontactStatus(chargeId: string) {
    const cur = currentRef.current
    if (!cur || cur.method !== 'bancontact' || cur.chargeId !== chargeId) return

    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${chargeId}`)
      const data = await res.json()
      if (!res.ok) return

      // providerStatus carries Bancontact's own rich vocabulary
      // (IDENTIFIED/AUTHORIZED/...) for display; data.status is the
      // collapsed pending/succeeded/failed the backend actually acts on.
      const displayStatus = data.providerStatus || (data.status === 'succeeded' ? 'SUCCEEDED' : data.status === 'failed' ? 'FAILED' : 'PENDING')
      setCurrentBoth({ ...cur, status: displayStatus })
      // Nothing to record here — the backend recorded the sale and closed
      // the tab when it resolved this charge.
      channelRef.current?.postMessage({ type: 'status', status: displayStatus })

      if (data.status === 'succeeded' || data.status === 'failed') stopCountdown()
    } catch (err) {
      console.error('Kon Bancontact status niet ophalen', err)
    }
  }

  async function checkSumupStatus(chargeId: string) {
    const cur = currentRef.current
    if (!cur || cur.method !== 'sumup' || cur.chargeId !== chargeId || cur.status === 'RESOLVED') return

    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${chargeId}`)
      const data = await res.json()
      if (!res.ok) return

      if (data.status === 'succeeded') {
        setCurrentBoth({ ...cur, status: 'RESOLVED' })
        setManualStatusText(MANUAL_METHOD_LABELS.sumup.paid)
        channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })
      } else if (data.status === 'failed') {
        setManualStatusText(
          data.errorMessage ? `SumUp betaling mislukt: ${data.errorMessage}` : 'SumUp betaling mislukt. Probeer opnieuw of bevestig handmatig.'
        )
      }
    } catch (err) {
      console.error('Kon SumUp status niet ophalen', err)
    }
  }

  async function resolveTrackedCharge(chargeId: string, success: boolean) {
    try {
      await fetch(`${WORKER_URL}/sumup/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId, success }),
      })
    } catch (err) {
      console.error('Kon betaling niet bijwerken', err)
    }
  }

  function confirmManualPayment() {
    // Guards against the SumUp push and this manual tap both trying to
    // complete the same payment.
    const cur = currentRef.current
    if (!cur || (cur.method !== 'cash' && cur.method !== 'sumup') || cur.status === 'RESOLVED') return
    stopCountdown()
    setCurrentBoth({ ...cur, status: 'RESOLVED' })
    setManualStatusText(MANUAL_METHOD_LABELS[cur.method].paid)
    channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })
    // Backend records the sale and closes the tab once it resolves the charge.
    resolveTrackedCharge(cur.chargeId, true)
  }

  function clearPaymentView() {
    stopCountdown()
    setCurrentBoth(null)
    setManualStatusText('')
    setError('')
    broadcastCurrent()

    if (posTerminalIdRef.current) {
      fetch(`${DEVICES_URL}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_terminal_id: posTerminalIdRef.current }),
      }).catch((err) => console.error('Kon klantscherm niet resetten', err))
    }
  }

  // Paid — back to Toog for the next customer.
  function finishPayment() {
    clearPaymentView()
    selectTab('quick')
  }

  // Back to the tab without paying. A cash (or reader-less SumUp) charge is
  // failed right away so the tab isn't blocked until it times out; a
  // Bancontact QR or a charge already sent to a real reader is left
  // pending — the customer could still complete it, and failing it here
  // would then lose a real payment. The poller times those out.
  async function cancelPayment() {
    const cur = currentRef.current
    if (cur && !isPaymentResolved(cur) && (cur.method === 'cash' || (cur.method === 'sumup' && !cur.dispatchedToReader))) {
      await resolveTrackedCharge(cur.chargeId, false)
    }
    clearPaymentView()
    selectTab(cur?.tabId || 'quick')
  }

  // --- Customer display ---

  async function openDisplay() {
    if (displayWindowRef.current && !displayWindowRef.current.closed) {
      displayWindowRef.current.focus()
      return
    }
    if (!posTerminalIdRef.current || !posOrgIdRef.current) {
      setError('Wacht tot dit toestel geregistreerd is voor u een klantscherm opent.')
      return
    }

    setOpeningDisplay(true)
    try {
      const existingCfd = await getLinkedDevice(posTerminalIdRef.current, 'cfd')
      if (existingCfd?.terminal_id) {
        await unlinkTerminal(existingCfd.terminal_id)
      }

      const cfdTerminalId = await registerRemoteTerminal('cfd', posOrgIdRef.current)
      await linkTerminals(posTerminalIdRef.current, cfdTerminalId)

      let features = 'width=1024,height=768'
      const getScreenDetails = (window as any).getScreenDetails
      if (typeof getScreenDetails === 'function') {
        try {
          const details = await getScreenDetails()
          const other = details.screens.find((s: any) => s !== details.currentScreen)
          if (other) {
            features = `left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`
          }
        } catch (err) {
          console.warn('Kon schermdetails niet ophalen, klantscherm wordt normaal geopend.', err)
        }
      }

      displayWindowRef.current = window.open(`/display.html?terminal=${encodeURIComponent(cfdTerminalId)}`, 'arcanum-display', features)
    } catch (err) {
      console.error('Kon klantscherm niet koppelen/openen', err)
      setError('Kon klantscherm niet openen.')
    } finally {
      setOpeningDisplay(false)
    }
  }

  // --- Effects ---

  useEffect(() => {
    fetch(`${WORKER_URL}/settings`)
      .then((res) => res.json())
      .then((data) => {
        setPricing((prev) => ({
          amountPerBonCents: Number.isInteger(data.amountPerBonCents) && data.amountPerBonCents > 0 ? data.amountPerBonCents : prev.amountPerBonCents,
          fietstochtMemberCents:
            Number.isInteger(data.fietstochtMemberCents) && data.fietstochtMemberCents > 0 ? data.fietstochtMemberCents : prev.fietstochtMemberCents,
          fietstochtNonMemberCents:
            Number.isInteger(data.fietstochtNonMemberCents) && data.fietstochtNonMemberCents > 0
              ? data.fietstochtNonMemberCents
              : prev.fietstochtNonMemberCents,
          wandeltochtMemberCents:
            Number.isInteger(data.wandeltochtMemberCents) && data.wandeltochtMemberCents > 0
              ? data.wandeltochtMemberCents
              : prev.wandeltochtMemberCents,
          wandeltochtNonMemberCents:
            Number.isInteger(data.wandeltochtNonMemberCents) && data.wandeltochtNonMemberCents > 0
              ? data.wandeltochtNonMemberCents
              : prev.wandeltochtNonMemberCents,
        }))
      })
      .catch((err) => console.error('Kon prijsinstellingen niet laden, gebruik standaardwaarden.', err))
  }, [])

  useEffect(() => {
    fetch('/whoami')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setUserLabel(`Ingelogd als ${data.name || data.email}`)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let socket: ReturnType<typeof connectNotifications> | null = null

    getRegisteredTerminal('pos').then((terminal) => {
      if (!terminal) {
        // Never went through the chooser (e.g. a bookmarked/direct URL) —
        // send them there to pick an organization + role properly.
        window.location.replace('/')
        return
      }

      posTerminalIdRef.current = terminal.terminalId
      posOrgIdRef.current = terminal.orgId
      setOrgId(terminal.orgId)
      setTerminalIdLabel(`POS-ID: ${terminal.terminalId}`)

      // Replaces polling: the notification socket pushes payment_updated
      // the moment a linked reader/simulator resolves a charge this POS
      // created.
      socket = connectNotifications(terminal.terminalId, {
        payment_updated: (msg) => {
          if (msg.method === 'sumup') checkSumupStatus(msg.payment_id)
          else if (msg.method === 'bancontact') checkBancontactStatus(msg.payment_id)
        },
      })
    })

    return () => socket?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The only cross-kassa sync for now: reload when this kassa is looked at
  // again. A live tab_updated push comes later (DOMAIN_MODEL.md).
  useEffect(() => {
    if (!orgId) return
    refreshTabs()
    function onVisible() {
      if (document.visibilityState === 'visible') refreshAll()
    }
    window.addEventListener('focus', refreshAll)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshAll)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useEffect(() => {
    const channel = new BroadcastChannel('arcanum-payment')
    channelRef.current = channel
    channel.onmessage = (event) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'request-state') broadcastCurrent()
      // The CFD's success overlay was tapped — only meaningful once paid.
      else if (msg.type === 'reset-requested' && currentRef.current && isPaymentResolved(currentRef.current)) finishPayment()
    }
    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showConfirmButton = current !== null && current.status !== 'RESOLVED'
  const draftKeys = new Set(Object.keys(drafts))
  const panelTitle = active === 'quick' ? `${QUICK_SALE_LABEL} — direct afrekenen` : shownTab ? tabTitle(shownTab) : 'Laden…'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <OrgBadge />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <AppBrand className="text-xl" />
          <div className="text-sm text-muted-foreground">
            <p>{getDeviceName()}</p>
            <p>{terminalIdLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{userLabel}</span>
          <Button variant="outline" size="sm" disabled={openingDisplay} onClick={openDisplay}>
            Klantscherm openen
          </Button>
          <a href="/settings.html" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Instellingen
          </a>
          <a href="/logout" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Uitloggen
          </a>
        </div>
      </div>

      <TabStrip tabs={tabs} active={active} draftKeys={draftKeys} disabled={busy || current !== null} onSelect={selectTab} onNew={() => setNameDialog('new')} />

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {!current && (
        <div className="grid items-start gap-4 md:grid-cols-[1fr_420px]">
          <ItemPicker pricing={pricing} disabled={busy || tabLoading || !!shownTab?.paymentPending} onAdd={addItem} />
          <div className="md:sticky md:top-4">
            <TabPanel
              title={panelTitle}
              tab={shownTab}
              draft={draft}
              paymentMethod={paymentMethod}
              busy={busy || tabLoading}
              onPaymentMethodChange={setPaymentMethod}
              onDraftQuantity={setDraftQuantity}
              onClearDraft={() => setDraftFor(active, [])}
              onVoid={setVoidTarget}
              onSubmitOrder={submitOrder}
              onPay={pay}
              onPark={() => setNameDialog('park')}
              onRename={() => setNameDialog('rename')}
              onCancelTab={cancelEmptyTab}
              onRefresh={refreshAll}
            />
          </div>
        </div>
      )}

      {current && (
        <div className="mx-auto w-full max-w-2xl">
          <PaymentStatus
            current={current}
            manualStatusText={manualStatusText}
            countdownText={countdownText}
            showConfirmButton={showConfirmButton}
            onConfirm={confirmManualPayment}
            onCancel={cancelPayment}
            onNext={finishPayment}
          />
        </div>
      )}

      <NameDialog
        key={nameDialog ?? 'closed'}
        open={nameDialog !== null}
        title={nameDialog === 'rename' ? 'Naam wijzigen' : nameDialog === 'park' ? 'Op rekening zetten' : 'Nieuwe rekening'}
        description={nameDialog === 'park' ? 'De bestelling komt op een nieuwe rekening die open blijft tot ze betaald wordt.' : undefined}
        confirmLabel={nameDialog === 'rename' ? 'Opslaan' : 'Rekening openen'}
        initialValue={nameDialog === 'rename' ? shownTab?.label || '' : ''}
        onConfirm={confirmNameDialog}
        onClose={() => setNameDialog(null)}
      />
      <VoidDialog key={voidTarget?.id ?? 'closed'} line={voidTarget} onConfirm={confirmVoid} onClose={() => setVoidTarget(null)} />
    </div>
  )
}
