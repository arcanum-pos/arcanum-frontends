import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import kabouterLogo from '@/shared/assets/kabouter.png'
import { getCatalogSelection, getDeviceId, getDeviceName, getSumupReader, setCatalogSelection } from '@/shared/device'
import {
  connectNotifications,
  getLinkedDevice,
  getRegisteredTerminal,
  getStoredTerminalInfo,
  linkTerminals,
  registerRemoteTerminal,
  unlinkTerminal,
} from '@/shared/terminal'
import { getCurrentSlotId } from '@/shared/slots'
import {
  addToDraft,
  clampTip,
  draftTotalCents,
  isPaymentResolved,
  MANUAL_METHOD_LABELS,
  readAmountCents,
  reconcileDrafts,
  tabBreakdownLines,
  type CurrentPayment,
  type PaymentMethod,
  type PickerItem,
} from './lib'
import { fetchKassaCatalog, type KassaCatalog } from './catalog-api'
import { ItemPicker, type CatalogState } from './ItemPicker'
import { PaymentStatus } from './PaymentStatus'
import { NameDialog, VoidDialog } from './TabDialogs'
import { TabPanel } from './TabPanel'
import { QUICK_SALE_LABEL, TabStrip, type ActiveKey } from './TabStrip'
import * as tabsApi from './tabs-api'
import { netQuantity, TabApiError, tabTitle, type DraftLine, type TabDetail, type TabLine, type TabSummary } from './tabs-api'

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
  // What this kassa sells from: the device's chosen catalog, else the org
  // default (see loadCatalog).
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: 'loading' })
  const [notice, setNotice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bancontact')
  // Fooi for the next payment, as typed (comma input). Added on top of the
  // outstanding amount; reset once a payment completes.
  const [tipInput, setTipInput] = useState('')
  const [current, setCurrent] = useState<CurrentPayment | null>(null)
  const [manualStatusText, setManualStatusText] = useState('')
  const [countdownText, setCountdownText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [terminalIdLabel, setTerminalIdLabel] = useState('')
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [orgName] = useState(() => getStoredTerminalInfo()?.orgName || '')
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
  const catalogRef = useRef<KassaCatalog | null>(null)
  const draftsRef = useRef<Record<string, DraftLine[]>>({})
  const activeRef = useRef<ActiveKey>('quick')
  activeRef.current = active
  const posTerminalIdRef = useRef<string | null>(null)
  const posOrgIdRef = useRef<string | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const displayWindowRef = useRef<Window | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  draftsRef.current = drafts
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
    // An entry vanished from the catalog since it was loaded — reload it
    // (the draft stays, so the cashier can see and fix what's refused).
    else if (err instanceof TabApiError && err.status === 400 && /menukaart/i.test(err.message)) loadCatalog()
  }

  // --- Catalog ---

  // Device override first (Instellingen → Menukaart); if that one is gone
  // (archived), forget it and fall back to the org default. Drafts are
  // lined up with the result: current catalog prices, and — only when the
  // kassa ended up on a *different* catalog — lines not on it are dropped.
  async function loadCatalog() {
    const org = posOrgIdRef.current
    if (!org) return
    try {
      let catalog: KassaCatalog | null = null
      const selection = getCatalogSelection()
      if (selection) {
        catalog = await fetchKassaCatalog(org, selection.id)
        if (!catalog) {
          setCatalogSelection(null)
          setNotice(`De gekozen menukaart "${selection.name}" is niet meer beschikbaar — de standaardmenukaart wordt gebruikt.`)
        }
      }
      if (!catalog) catalog = await fetchKassaCatalog(org, null)

      const previousId = catalogRef.current?.id ?? null
      catalogRef.current = catalog
      setCatalogState(catalog ? { status: 'ok', catalog } : { status: 'none' })

      const switched = previousId !== null && previousId !== (catalog?.id ?? null)
      const { drafts: next, dropped } = reconcileDrafts(draftsRef.current, catalog, switched)
      setDrafts(next)
      if (dropped > 0) {
        setNotice(
          dropped === 1
            ? 'Andere menukaart geladen — 1 lijn die er niet op staat, is uit de bestelling gehaald.'
            : `Andere menukaart geladen — ${dropped} lijnen die er niet op staan, zijn uit de bestelling gehaald.`
        )
      }
    } catch (err) {
      console.error('Kon menukaart niet laden', err)
      if (!catalogRef.current) setCatalogState({ status: 'error', message: 'Kon de menukaart niet laden. Probeer opnieuw.' })
    }
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
    loadCatalog()
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
      setActiveTab(await tabsApi.addOrder(org, key, draft, catalogRef.current?.id ?? null))
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
      const tab = await tabsApi.createTab(org, name, getCurrentSlotId(), lines, catalogRef.current?.id ?? null)
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
  // with it), then charges exactly what's outstanding plus the tip — the
  // server refuses any other amount.
  function pay() {
    const key = active
    const tipCents = clampTip(readAmountCents(tipInput))
    runTabAction(async (org) => {
      let tab: TabDetail
      if (key === 'quick') {
        tab = await tabsApi.createTab(org, QUICK_SALE_LABEL, getCurrentSlotId(), draft, catalogRef.current?.id ?? null)
        setDraftFor('quick', [])
        // From here on it's a real tab: if the payment fails or is
        // cancelled, it stays open in the strip to retry, void or close.
        setActive(tab.id)
        activeRef.current = tab.id
      } else if (draft.length > 0) {
        tab = await tabsApi.addOrder(org, key, draft, catalogRef.current?.id ?? null)
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
      await startCharge(org, tab, tipCents)
    })
  }

  async function startCharge(org: string, tab: TabDetail, tipCents: number) {
    const amountCents = tab.outstandingCents + tipCents
    const breakdown = tabBreakdownLines(tab, tipCents)
    const common = {
      amount: amountCents,
      tipCents,
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
        tipCents,
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
      tipCents,
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

  // Paid — back to Toog for the next customer (without the tip).
  function finishPayment() {
    setTipInput('')
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
    fetch('/whoami')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setUser({ name: data.name || data.email || '', email: data.email || '' })
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
      setTerminalIdLabel(terminal.terminalId)

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
    loadCatalog()
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
  const itemCount = draft.reduce((n, l) => n + l.quantity, 0) + (shownTab?.lines || []).filter((l) => !l.voidsLineId).reduce((n, l) => n + netQuantity(l), 0)
  const panelSubtitle = `${active === 'quick' ? 'Nieuwe rekening bij afrekenen' : 'Open rekening'} · ${itemCount === 1 ? '1 item' : `${itemCount} items`}`
  const draftQuantities = Object.fromEntries(draft.map((l) => [l.variantId, l.quantity]))
  const catalogName = catalogState.status === 'ok' ? catalogState.catalog.name : null

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      {/* Header: where this kassa is (org · device · menukaart), who's on it, and the open tabs. */}
      <header className="border-b bg-card">
        <div className="flex flex-wrap items-center gap-3.5 px-5 pt-3 pb-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-foreground text-[11px] font-bold tracking-tight text-background" aria-hidden="true">
              {initials(orgName) || <img src={kabouterLogo} alt="" className="size-4 invert dark:invert-0" />}
            </div>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="truncate text-[14.5px] font-semibold tracking-tight">{orgName || 'Kassa'}</span>
              <span className="truncate text-[11.5px] text-muted-foreground">
                {[getDeviceName(), catalogName && `Menukaart ${catalogName}`, terminalIdLabel && `POS ${terminalIdLabel.slice(0, 8)}`].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
          <div className="min-w-5 flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-[34px] px-3 text-[13px]" disabled={openingDisplay} onClick={openDisplay}>
              Klantscherm openen
            </Button>
            <Button variant="outline" className="h-[34px] px-3 text-[13px]" asChild>
              <a href="/settings.html">Instellingen</a>
            </Button>
            {user && (
              <div className="flex items-center gap-2 border-l pl-2.5">
                <div className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10.5px] font-semibold text-foreground/75" aria-hidden="true">
                  {initials(user.name)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium">{user.name}</span>
                  <a href="/logout" className="text-[10.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    Uitloggen
                  </a>
                </div>
              </div>
            )}
            {!user && (
              <a href="/logout" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
                Uitloggen
              </a>
            )}
          </div>
        </div>
        <div className="px-5 pb-2.5">
          <TabStrip tabs={tabs} active={active} draftKeys={draftKeys} quickTotalCents={draftTotalCents(drafts.quick || [])} disabled={busy || current !== null} onSelect={selectTab} onNew={() => setNameDialog('new')} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-6">
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        {notice && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <p>{notice}</p>
            <Button variant="ghost" size="sm" onClick={() => setNotice('')}>
              Sluiten
            </Button>
          </div>
        )}

        {!current && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_392px]">
            <ItemPicker catalogState={catalogState} quantities={draftQuantities} disabled={busy || tabLoading || !!shownTab?.paymentPending} onAdd={addItem} />
            <div className="lg:sticky lg:top-4">
              <TabPanel
                title={panelTitle}
                subtitle={panelSubtitle}
                tab={shownTab}
                draft={draft}
                paymentMethod={paymentMethod}
                tipInput={tipInput}
                onTipInputChange={setTipInput}
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
          <div className="flex flex-1 items-start justify-center pt-6">
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
      </main>

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

// "Scouts Elewijt" → "SE", "Bert Hekman" → "BH" (the design's avatar tiles).
function initials(name: string): string {
  return name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
