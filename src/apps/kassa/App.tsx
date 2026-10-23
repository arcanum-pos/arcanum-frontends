import { useWaiterOnly, WaiterOnly } from '@/shared/waiter-only'
import { Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getRegister, registerState, setRegister, type RegisterState } from '@/shared/register'
import { CashUp, MovementDialog, OpenRegister, useShiftTexts } from './Shift'
import { chosenStaff, listStaff, staffHeaders } from '@/shared/staff'
import { StaffButton } from '@/shared/staff-picker'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import kabouterLogo from '@/shared/assets/kabouter.png'
import { getCatalogSelection, getDeviceId, getDeviceName, getEventSelection, getSumupReader, setCatalogSelection, setEventSelection, type EventSelection } from '@/shared/device'
import { connectNotifications, getRegisteredTerminal, getStoredTerminalInfo, openCompanionDisplay, resetKassa } from '@/shared/terminal'
import { DemoBar } from './DemoBar'
import { getCurrentSlotId } from '@/shared/slots'
import { apiErrorMessage } from '@/shared/api-errors'
import { formatEuro } from '@/shared/format'
import type { ApiErrorCode } from '@/shared/api-errors'
import { useMessages } from '@/shared/i18n'
import {
  addToDraft,
  changeQuantity,
  subtractDraft,
  clampTip,
  customerOrderFromTab,
  customerViewOrder,
  selectionCents,
  selectionLines,
  type ItemSelection,
  draftTotalCents,
  tabQuantities,
  isPaymentResolved,
  readAmountCents,
  reconcileDrafts,
  tabBreakdownLines,
  type CurrentPayment,
  type ManualStatus,
  type PaymentMethod,
  type PickerItem,
} from './lib'
import { fetchKassaCatalog, listEvents, type KassaCatalog } from './catalog-api'
import { clampPanel, PANEL_DEFAULT, PANEL_MIN, panelMax, readPanelWidth, writePanelWidth } from './layout'
import { PanelDivider } from './PanelDivider'
import { ItemPicker, type CatalogState } from './ItemPicker'
import { PaymentStatus } from './PaymentStatus'
import { CancelTicketDialog, NameDialog, VoidDialog } from './TabDialogs'
import { KASSA_MESSAGES } from './messages'
import { SplitDialog } from './SplitDialog'
import { TabPanel } from './TabPanel'
import { TabsOverview } from './TabsOverview'
import { TabStrip, type ActiveKey } from './TabStrip'
import * as tabsApi from './tabs-api'
import { netQuantity, QUICK_SALE_LABEL, TabApiError, tabTitle, type DraftLine, type TabDetail, type TabLine, type TabSummary } from './tabs-api'
import { showOrgIcons } from '@/shared/install'
import type { CustomerOrder } from '@/shared/customer-order'

const WORKER_URL = '/api/bancontact'

// Refusals that mean this kassa's catalog is out of date.
const CATALOG_ERRORS = new Set<ApiErrorCode>(['unknown_catalog', 'product_not_on_catalog', 'catalog_not_found', 'no_catalog', 'unknown_product'])

type NameDialogMode = 'new' | 'park' | 'rename'

// Every sale goes through a tab (DOMAIN_MODEL.md: "a counter sale is a tab
// that is paid immediately"). The Toog button is a local draft that becomes
// a brand-new tab only when paid or parked; named tabs live on the server
// and are shared by every kassa of the org. No live sync between kassas yet
// — the open-tab list reloads on focus, on switching and after every
// action, and the server refuses anything based on a stale view (409).
// The "Bestelling tonen" switch, remembered on this kassa (on unless switched off).
// An open tab's round is sent this long after the last tap (or sooner: leaving the tab, paying).
const ROUND_IDLE_MS = 30_000

const SHOW_ORDER_KEY = 'arcanum-cfd-show-order'

function readShowOrder(): boolean {
  try {
    return localStorage.getItem(SHOW_ORDER_KEY) !== 'off'
  } catch {
    return true
  }
}

function storeShowOrder(on: boolean) {
  try {
    if (on) localStorage.removeItem(SHOW_ORDER_KEY)
    else localStorage.setItem(SHOW_ORDER_KEY, 'off')
  } catch {
    // not remembered
  }
}

export default function App() {
  // Fixed while the page is open (the language is changed in Instellingen),
  // so texts put in state below are safe to build from it right away.
  const m = useMessages(KASSA_MESSAGES)
  // What this kassa sells from: the device's chosen catalog, else the org
  // default (see loadCatalog).
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: 'loading' })
  // The event new rekeningen (and so their sales) are tagged with — optional.
  const [event, setEvent] = useState<EventSelection | null>(() => getEventSelection())
  const eventRef = useRef<EventSelection | null>(event)
  // Whether the customer display shows the order while it's entered (the
  // cashier's switch, per kassa — off while checking tabs). Payments always show.
  const [showOrder, setShowOrder] = useState(readShowOrder)
  // What the customer display was last told while the order is entered, and sent to the backend.
  const customerViewRef = useRef<{ order: CustomerOrder | null; seq: number }>({ order: null, seq: 0 })
  const customerViewSentRef = useRef<string | null>(null)
  eventRef.current = event
  // The event's ordering modes, when it lets the kassa pick one; with more
  // than one, the one a new order gets (sticky until changed) — information
  // for the stations, never routing.
  const [kassaModes, setKassaModes] = useState<{ id: string; name: string }[]>([])
  const [orderModeId, setOrderModeId] = useState<string | null>(null)
  const orderModeRef = useRef<string | null>(null)
  orderModeRef.current = kassaModes.length > 1 ? orderModeId : null
  const [notice, setNotice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bancontact')
  // SumUp Tap to Pay set up for the org (the SumUp app on a phone): a fourth method.
  const [tapToPay, setTapToPay] = useState(false)
  // Fooi for the next payment, as typed (comma input). Added on top of the
  // outstanding amount; reset once a payment completes.
  const [tipInput, setTipInput] = useState('')
  const [current, setCurrent] = useState<CurrentPayment | null>(null)
  const [manualStatus, setManualStatus] = useState<ManualStatus | null>(null)
  const [countdownText, setCountdownText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [terminalIdLabel, setTerminalIdLabel] = useState('')
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [orgName] = useState(() => getStoredTerminalInfo()?.orgName || '')
  const [openingDisplay, setOpeningDisplay] = useState(false)

  const [orgId, setOrgId] = useState<string | null>(null)
  // Who's working on this kassa (staff, release B1): the picker, and whether
  // the organisation requires someone to be chosen (S2).
  const [staffOpen, setStaffOpen] = useState(false)
  const [staffRequired, setStaffRequired] = useState(false)
  // The register (cash drawer) this kassa sells on, and its shift (release
  // B2): none chosen = sells as before. Its kasopmaak, a cash movement, and
  // the question at logout while the drawer is still open.
  const [regState, setRegState] = useState<RegisterState | null>(null)
  const [cashUpOpen, setCashUpOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const st = useShiftTexts()
  const waiterOnly = useWaiterOnly(orgId)
  const [tabs, setTabs] = useState<TabSummary[]>([])
  const [active, setActive] = useState<ActiveKey>('quick')
  const [activeTab, setActiveTab] = useState<TabDetail | null>(null)
  // Unsubmitted lines per tab ('quick' = the Toog draft), kept per tab so
  // switching away and back doesn't lose them. Local to this kassa only.
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({})
  const [nameDialog, setNameDialog] = useState<NameDialogMode | null>(null)
  // The tab panel's width, this till's (layout.ts) — within what the screen allows.
  const [panelWidth, setPanelWidth] = useState(() => readPanelWidth() ?? PANEL_DEFAULT)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [voidTarget, setVoidTarget] = useState<TabLine | null>(null)
  // "Ticket annuleren" asked for the shown tab.
  const [cancellingTicket, setCancellingTicket] = useState(false)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  // Split per item: on which rekening, and the units picked for the next payment.
  const [itemMode, setItemMode] = useState<{ tabId: string; selection: ItemSelection } | null>(null)
  const itemModeRef = useRef(itemMode)
  itemModeRef.current = itemMode
  // The Rekeningen overview in place of the kassa, and a counter that tells
  // it to reload (a tabs_changed push, Vernieuwen).
  const [view, setView] = useState<'kassa' | 'overview'>('kassa')
  const [tabsSignal, setTabsSignal] = useState(0)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // What a same-device CFD shows when idle: the event, if any — and whose
  // logo and colours (its org, and the event's own colours).
  function broadcastContext() {
    channelRef.current?.postMessage({ type: 'context', eventName: eventRef.current?.name ?? null, eventId: eventRef.current?.id ?? null, orgId: posOrgIdRef.current })
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
      setCountdownText(secondsLeft > 0 ? m.expiresIn(secondsLeft) : m.expired)
      if (secondsLeft <= 0 && countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }, 1000)
  }

  // --- Tabs ---

  function setDraftFor(key: ActiveKey, lines: DraftLine[]) {
    updateDraft(key, () => lines)
  }

  // From the latest state, never a render's copy: a round that was just sent
  // in the background must not come back with the next tap.
  function updateDraft(key: ActiveKey, change: (lines: DraftLine[]) => DraftLine[]) {
    const apply = (prev: Record<string, DraftLine[]>) => {
      const lines = change(prev[key] || [])
      const next = { ...prev }
      if (lines.length > 0) next[key] = lines
      else delete next[key]
      return next
    }
    draftsRef.current = apply(draftsRef.current)
    setDrafts(apply)
  }

  // An open tab's round goes to the server (and the kitchen/bar, as one
  // ticket) by itself — when the cashier leaves the tab, pays, or stops
  // tapping for a while — no button. What's tapped while it's on its way
  // stays for the next round. One at a time per tab; a payment waits for
  // it (submitDraftFirst). `rethrow`: the caller shows the error itself.
  const commitsRef = useRef(new Map<string, Promise<TabDetail | null>>())
  async function commitDraft(key: ActiveKey, rethrow = false): Promise<TabDetail | null> {
    if (key === 'quick') return null
    const pending = commitsRef.current.get(key)
    if (pending) await pending.catch(() => null)
    const org = posOrgIdRef.current
    const lines = draftsRef.current[key]
    if (!org || !lines?.length) return null
    const run = tabsApi.addOrder(org, key, lines, catalogRef.current?.id ?? null).then((tab) => {
      updateDraft(key, (current) => subtractDraft(current, lines))
      if (activeRef.current === key) setActiveTab(tab)
      refreshTabs()
      return tab
    })
    commitsRef.current.set(key, run)
    try {
      return await run
    } catch (err) {
      if (rethrow) throw err
      showError(err)
      return null
    } finally {
      if (commitsRef.current.get(key) === run) commitsRef.current.delete(key)
    }
  }
  const commitDraftRef = useRef(commitDraft)
  commitDraftRef.current = commitDraft

  // Leaving a tab (another tab, Toog) or the kassa view (Rekeningen) sends its round.
  const leftRef = useRef<ActiveKey>(active)
  useEffect(() => {
    const left = leftRef.current
    leftRef.current = active
    if (left !== active) commitDraftRef.current(left)
  }, [active])
  useEffect(() => {
    if (view !== 'kassa') commitDraftRef.current(activeRef.current)
  }, [view])
  // A pause: no tap for ROUND_IDLE_MS on an open tab's round.
  const activeDraft = drafts[active]
  useEffect(() => {
    if (active === 'quick' || !activeDraft?.length) return
    const timer = setTimeout(() => commitDraftRef.current(active), ROUND_IDLE_MS)
    return () => clearTimeout(timer)
  }, [active, activeDraft])
  // The kassa goes out of sight (another app, the screen off, logging out): every round goes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      for (const key of Object.keys(draftsRef.current)) commitDraftRef.current(key)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : String(err))
    // The organisation requires a person, and none is chosen: ask now.
    if (err instanceof TabApiError && err.code === 'staff_required') {
      setStaffRequired(true)
      setStaffOpen(true)
    }
    // A 409 means this kassa's view was stale — pull the current state.
    if (err instanceof TabApiError && err.status === 409) refreshAll()
    // An entry vanished from the catalog since it was loaded — reload it
    // (the draft stays, so the cashier can see and fix what's refused).
    else if (err instanceof TabApiError && err.code && CATALOG_ERRORS.has(err.code)) loadCatalog()
    // The chosen event is gone: check it again (drops it, with a notice).
    else if (err instanceof TabApiError && (err.code === 'unknown_event' || err.code === 'unknown_order_mode')) loadEvent()
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
          setNotice(m.catalogGone(selection.name))
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
        setNotice(m.linesDropped(dropped))
      }
    } catch (err) {
      console.error('Kon menukaart niet laden', err)
      if (!catalogRef.current) setCatalogState({ status: 'error', message: m.catalogFailed })
    }
  }

  // The event chosen in Instellingen (maybe in another window since): kept
  // only while it still exists for the org, with its current name.
  async function loadEvent() {
    const chosen = getEventSelection()
    const org = posOrgIdRef.current
    if (!chosen || !org) {
      setEvent(chosen)
      setKassaModes([])
      return
    }
    try {
      const current = (await listEvents(org)).find((e) => e.id === chosen.id)
      if (!current) {
        setEventSelection(null)
        setEvent(null)
        setNotice(m.eventGone(chosen.name))
        return
      }
      const modes = current.kassaModes ? (current.modes || []).map((mode) => ({ id: mode.id, name: mode.name })) : []
      setKassaModes(modes)
      setOrderModeId((chosenMode) => (modes.some((mode) => mode.id === chosenMode) ? chosenMode : (modes[0]?.id ?? null)))
      const fresh = { id: current.id, name: current.name, date: current.date }
      if (fresh.name !== chosen.name || fresh.date !== chosen.date) setEventSelection(fresh)
      setEvent(fresh)
    } catch (err) {
      console.error('Kon evenementen niet laden', err)
      setEvent(chosen)
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

  // Everything this kassa shows from the server, e.g. on focus or Vernieuwen.
  async function loadRegister() {
    const org = posOrgIdRef.current
    const choice = getRegister(org)
    if (!org || !choice) return setRegState(null)
    try {
      setRegState(await registerState(org, choice.id))
    } catch (err) {
      // Removed in the console since: this kassa has no register anymore.
      if ((err as { code?: string }).code === 'register_not_found') {
        setRegister(null)
        setRegState(null)
      }
    }
  }
  const loadRegisterRef = useRef(loadRegister)
  loadRegisterRef.current = loadRegister

  // Kasopmaak counts against what the shift adds up to right now — the
  // payments since this kassa last looked included.
  async function openCashUp() {
    await loadRegister()
    setCashUpOpen(true)
  }

  async function refreshAll() {
    loadCatalog()
    loadEvent()
    loadRegister()
    setTabsSignal((n) => n + 1)
    await syncTabs()
  }

  // The open-tab list and the selected tab. Also notices a tab that was
  // closed or cancelled on another kassa in the meantime and falls back to
  // Toog.
  async function syncTabs() {
    const list = await refreshTabs()
    const key = activeRef.current
    if (list && key !== 'quick' && !list.some((t) => t.id === key) && !currentRef.current) {
      setError(m.tabClosedElsewhere)
      setDraftFor(key, [])
      selectTab('quick')
      return
    }
    await loadTab(key)
  }

  // Another kassa changed a tab (devicehub's tabs_changed): pull the list
  // and the selected tab — once for a burst of pushes.
  function scheduleSync() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null
      setTabsSignal((n) => n + 1)
      syncTabs()
    }, 250)
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
    updateDraft(active, (lines) => addToDraft(lines, item, quantity))
  }

  // Right-click on a product: one (or a quick quantity) less on the draft.
  // Submitted lines aren't touched — those only go away with a void.
  function removeItem(item: PickerItem, quantity: number) {
    setError('')
    updateDraft(active, (lines) => changeQuantity(lines, item.variantId, (q) => q - quantity))
  }

  function setDraftQuantity(variantId: string, quantity: number) {
    updateDraft(active, (lines) => changeQuantity(lines, variantId, () => quantity))
  }

  async function runTabAction(action: (org: string) => Promise<void>) {
    const org = posOrgIdRef.current
    if (!org) {
      setError(m.orgUnknown)
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
      const tab = await tabsApi.createTab(org, name, getCurrentSlotId(), lines, catalogRef.current?.id ?? null, eventRef.current?.id ?? null, orderModeRef.current)
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

  // The whole ticket: every line voided with the reason, then cancelled (one step,
  // server-side); what was still in the draft goes too.
  function confirmCancelTicket(reason: string) {
    setCancellingTicket(false)
    if (!shownTab) return
    const tabId = shownTab.id
    runTabAction(async (org) => {
      await tabsApi.cancelTab(org, tabId, reason, true)
      setDraftFor(tabId, [])
      selectTab('quick')
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
  // Whatever's still in the draft goes onto the server first (for Toog:
  // creates the tab with it) — paying and splitting both work on the tab.
  async function submitDraftFirst(org: string, key: ActiveKey): Promise<TabDetail> {
    let tab: TabDetail
    if (key === 'quick') {
      tab = await tabsApi.createTab(org, QUICK_SALE_LABEL, getCurrentSlotId(), draft, catalogRef.current?.id ?? null, eventRef.current?.id ?? null, orderModeRef.current)
      setDraftFor('quick', [])
      // From here on it's a real tab: if the payment fails or is
      // cancelled, it stays open in the strip to retry, void or close.
      setActive(tab.id)
      activeRef.current = tab.id
    } else {
      tab = (await commitDraft(key, true)) ?? (await tabsApi.getTab(org, key))
    }
    setActiveTab(tab)
    refreshTabs()
    return tab
  }

  // "Gelijk verdelen": split what's open into `parts` payments.
  function startSplit(parts: number) {
    setSplitDialogOpen(false)
    const key = active
    runTabAction(async (org) => {
      const tab = await submitDraftFirst(org, key)
      setActiveTab(await tabsApi.setSplit(org, tab.id, parts))
      refreshTabs()
    })
  }

  // Per item: each person pays what they had, picked on the ticket.
  function startItems() {
    setSplitDialogOpen(false)
    const key = active
    runTabAction(async (org) => {
      const tab = await submitDraftFirst(org, key)
      setItemMode({ tabId: tab.id, selection: {} })
    })
  }

  function stopSplit() {
    if (!shownTab) return
    const tabId = shownTab.id
    runTabAction(async (org) => {
      setActiveTab(await tabsApi.setSplit(org, tabId, null))
      refreshTabs()
    })
  }

  function pay() {
    const key = active
    const tipCents = clampTip(readAmountCents(tipInput))
    runTabAction(async (org) => {
      const tab = await submitDraftFirst(org, key)
      const items = itemModeRef.current?.tabId === tab.id ? itemModeRef.current.selection : null
      if (items) {
        if (selectionCents(tab, items) < 1) {
          setError(m.pickFirst)
          return
        }
        await startCharge(org, tab, tipCents, items)
        return
      }

      if (tab.outstandingCents < 1) {
        setError(m.nothingToPay)
        return
      }
      await startCharge(org, tab, tipCents)
    })
  }

  // Charges what's outstanding — or, while split, the next part — plus the
  // tip. The server refuses more than what's open.
  // Per item (`items`): exactly the picked units — sent as lines, the server
  // checks they cost the amount and aren't paid yet.
  async function startCharge(org: string, tab: TabDetail, tipCents: number, items: ItemSelection | null = null) {
    const picked = items ? selectionLines(tab, items) : null
    const split = picked ? null : (tab.split ?? null)
    const amountCents = (picked ? selectionCents(tab, items!) : split ? split.nextCents : tab.outstandingCents) + tipCents
    const part = split ? { index: Math.min(split.paid + 1, split.parts), of: split.parts } : undefined
    const remainsOpen = amountCents - tipCents < tab.outstandingCents
    const breakdown = picked
      ? [...picked.map((x) => `${x.quantity} × ${x.line.name}`), ...(tipCents > 0 ? [m.breakdownTip(formatEuro(tipCents))] : [])]
      : tabBreakdownLines(m, tab, tipCents)
    const order = {
      ...customerOrderFromTab(m, tab),
      paying: picked ? picked.map((x) => ({ name: x.line.name, quantity: x.quantity, unitPriceCents: x.line.unitPriceCents })) : null,
    }
    const common = {
      amount: amountCents,
      tipCents,
      splitPart: split ? true : undefined,
      lines: picked ? picked.map((x) => ({ lineId: x.line.id, quantity: x.quantity })) : undefined,
      orgId: org,
      tabId: tab.id,
      posTerminalId: posTerminalIdRef.current || undefined,
      slotId: getCurrentSlotId(),
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      registerId: getRegister(org)?.id,
    }

    if (paymentMethod === 'bancontact') {
      const res = await fetch(`${WORKER_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...staffHeaders(org) },
        body: JSON.stringify(common),
      })
      const data = await res.json()
      if (!res.ok) {
        const error = TabApiError.fromResponse(res.status, data, m.unknownError)
        throw data.details ? new TabApiError(`${error.message}: ${JSON.stringify(data.details)}`, error.status, error.tab, error.code) : error
      }

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
        order,
        part,
        remainsOpen,
      })
      broadcastCurrent()
      startCountdown(data.expiresAt)
      checkBancontactStatus(data.chargeId) // one immediate check, in case it resolves before the push arrives
      return
    }

    // Cash and SumUp are both "manual confirm" flows: the cashier collects
    // payment outside the app (or the linked reader resolves it) and
    // confirms here so it's recorded under the right method.
    // Tap to Pay: a SumUp payment the SumUp app takes, on this kassa's phone
    // (it gets a notification) or any phone scanning the QR; SumUp confirms it.
    const method = paymentMethod
    const tap = method === 'tap'
    const readerId = method === 'sumup' ? getSumupReader()?.id : undefined
    const res = await fetch(`${WORKER_URL}/sumup/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...staffHeaders(org) },
      body: JSON.stringify({ ...common, method: tap ? 'sumup' : method, readerId, ...(tap ? { app: true } : {}) }),
    })
    const data = await res.json()
    if (!res.ok || !data.chargeId) throw TabApiError.fromResponse(res.status, data, m.chargeFailed)

    setCurrentBoth({
      method,
      status: 'AWAITING_MANUAL',
      chargeId: data.chargeId,
      tabId: tab.id,
      tipCents,
      amountCents,
      breakdown,
      order,
      part,
      remainsOpen,
      dispatchedToReader: !!readerId,
      tapToken: tap ? data.tapToken : undefined,
    })
    setManualStatus({ kind: 'waiting' })
    broadcastCurrent()
    if (method === 'sumup' || tap) checkSumupStatus(data.chargeId)
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
    if (!cur || (cur.method !== 'sumup' && cur.method !== 'tap') || cur.chargeId !== chargeId || cur.status === 'RESOLVED') return

    try {
      const res = await fetch(`${WORKER_URL}/sumup/status/${chargeId}`)
      const data = await res.json()
      if (!res.ok) return

      if (data.status === 'succeeded') {
        setCurrentBoth({ ...cur, status: 'RESOLVED' })
        setManualStatus({ kind: 'paid' })
        channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })
      } else if (data.status === 'failed') {
        setManualStatus({ kind: 'failed', error: data.errorMessage || null })
        channelRef.current?.postMessage({ type: 'status', status: 'FAILED' })
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
    setManualStatus({ kind: 'paid' })
    channelRef.current?.postMessage({ type: 'status', status: 'SUCCEEDED' })
    // Backend records the sale and closes the tab once it resolves the charge.
    resolveTrackedCharge(cur.chargeId, true)
  }

  function clearPaymentView() {
    stopCountdown()
    setCurrentBoth(null)
    setManualStatus(null)
    setError('')
    broadcastCurrent()

    if (posTerminalIdRef.current && posOrgIdRef.current) {
      resetKassa(posOrgIdRef.current, posTerminalIdRef.current).catch((err) => console.error('Kon klantscherm niet resetten', err))
    }
  }

  // Paid — back to Toog for the next customer (without the tip).
  // Paid. A rekening with something still open (the next part of a split)
  // stays selected for the next payment; otherwise back to Toog for the
  // next customer. Never keeps the tip.
  function finishPayment() {
    const tabId = currentRef.current?.tabId
    setTipInput('')
    clearPaymentView()
    // The shift's totals moved (what the drawer should hold).
    loadRegister()
    const org = posOrgIdRef.current
    if (!tabId || !org) {
      selectTab('quick')
      return
    }
    tabsApi
      .getTab(org, tabId)
      .then((tab) => {
        const more = tab.status === 'open' && tab.outstandingCents > 0
        // Per item: the next person starts with nothing picked.
        setItemMode((m) => (m && m.tabId === tabId && more ? { tabId, selection: {} } : m && m.tabId === tabId ? null : m))
        selectTab(more ? tab.id : 'quick')
      })
      .catch(() => selectTab('quick'))
  }

  // Back to the tab without paying. A cash (or reader-less SumUp) charge is
  // failed right away so the tab isn't blocked until it times out; a
  // Bancontact QR or a charge already sent to a real reader is left
  // pending — the customer could still complete it, and failing it here
  // would then lose a real payment. The poller times those out.
  async function cancelPayment() {
    const cur = currentRef.current
    // Tap to Pay: the backend asks SumUp first — just paid on the phone, it
    // stays paid (and is shown so) instead of being cancelled.
    if (cur && cur.method === 'tap' && !isPaymentResolved(cur)) {
      const res = await fetch(`${WORKER_URL}/sumup/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId: cur.chargeId, success: false }),
      }).catch(() => null)
      const data = res?.ok ? await res.json().catch(() => null) : null
      if (data?.status === 'succeeded') {
        await checkSumupStatus(cur.chargeId)
        return
      }
      clearPaymentView()
      selectTab(cur.tabId || 'quick')
      return
    }
    if (cur && !isPaymentResolved(cur) && (cur.method === 'cash' || (cur.method === 'sumup' && !cur.dispatchedToReader))) {
      await resolveTrackedCharge(cur.chargeId, false)
    }
    // A Bancontact QR or a SumUp reader waiting: stopped at the provider
    // (arcanum-backend asks it first — just paid, it stays paid). Not
    // reachable: it stays here, with a word to try again.
    if (cur && !isPaymentResolved(cur) && (cur.method === 'bancontact' || (cur.method === 'sumup' && cur.dispatchedToReader))) {
      const res = await fetch(`${WORKER_URL}/sumup/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId: cur.chargeId, success: false }),
      }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      if (!res || !res.ok) {
        setError(data ? apiErrorMessage(data, m.cancelFailed) : m.cancelFailed)
        return
      }
      if (data?.status === 'succeeded') {
        await (cur.method === 'bancontact' ? checkBancontactStatus(cur.chargeId) : checkSumupStatus(cur.chargeId))
        return
      }
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
      setError(m.waitForRegistration)
      return
    }

    setOpeningDisplay(true)
    try {
      // Registered and linked by the backend, replacing the display this kassa had.
      const cfdTerminalId = await openCompanionDisplay(posOrgIdRef.current, posTerminalIdRef.current)

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
      setError(m.displayFailed)
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
        // Not paired (or removed in the console since): the start page,
        // where a device is paired with a code.
        window.location.replace('/')
        return
      }

      posTerminalIdRef.current = terminal.terminalId
      posOrgIdRef.current = terminal.orgId
      setOrgId(terminal.orgId)
      // Just started (or reloaded): no payment on this kassa, so its customer
      // display rests too — never left showing an old QR.
      if (!currentRef.current) {
        broadcastCurrent()
        resetKassa(terminal.orgId, terminal.terminalId).catch(() => {})
      }
      showOrgIcons(terminal.orgId, 'kassa')
      loadTapToPay(terminal.orgId)
      setTerminalIdLabel(terminal.terminalId)

      // Replaces polling: the notification socket pushes payment_updated
      // the moment a reader resolves a charge this POS
      // created.
      socket = connectNotifications(terminal.terminalId, {
        payment_updated: (msg) => {
          if (msg.method === 'sumup') checkSumupStatus(msg.payment_id)
          else if (msg.method === 'bancontact') checkBancontactStatus(msg.payment_id)
        },
        tabs_changed: () => scheduleSync(),
        // Another kassa of this register opened or closed the drawer.
        shift_changed: () => loadRegisterRef.current(),
      })
    })

    return () => {
      socket?.close()
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Is Tap to Pay set up for the org? The readers list says so — also when
  // SumUp itself can't list the readers right now (then a 502 that still
  // carries it). Asked again whenever the kassa is looked at again (set up
  // in the console meanwhile).
  function loadTapToPay(org: string) {
    fetch(`${WORKER_URL}/sumup/readers?org_id=${encodeURIComponent(org)}`)
      .then((res) => res.json())
      .then((data) => setTapToPay(data?.tapToPay === true))
      .catch(() => {})
  }
  useEffect(() => {
    if (!orgId) return
    const onVisible = () => document.visibilityState === 'visible' && loadTapToPay(orgId)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [orgId])

  // Besides the live tabs_changed push: reload when this kassa is looked at
  // again (a push missed while the socket was down).
  useEffect(() => {
    if (!orgId) return
    refreshTabs()
    loadCatalog()
    loadEvent()
    loadRegister()
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

  // Whether this organisation requires a person — then the picker opens
  // right away when nobody is chosen yet.
  useEffect(() => {
    if (!orgId) return
    listStaff(orgId)
      .then((r) => {
        setStaffRequired(r.required)
        if (r.required && !chosenStaff(orgId)) setStaffOpen(true)
      })
      .catch(() => {})
  }, [orgId])

  useEffect(() => {
    const channel = new BroadcastChannel('arcanum-payment')
    channelRef.current = channel
    channel.onmessage = (event) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'request-state') {
        broadcastContext()
        broadcastCurrent()
        channel.postMessage({ type: 'order-view', ...customerViewRef.current })
      }
      // The CFD's success overlay was tapped — only meaningful once paid.
      else if (msg.type === 'reset-requested' && currentRef.current && isPaymentResolved(currentRef.current)) finishPayment()
    }
    return () => channel.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    broadcastContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.name, event?.id, orgId])

  // The customer display while the order is entered: the order on this
  // screen (customerViewOrder), a moment after the last tap — to a display in
  // a second window of this kassa directly, to one on another device through
  // the backend (customer-view.ts: it pushes, the display fetches). The
  // customer says whether it's right; then the cashier asks for the payment.
  // Not while a tab is still loading (no flicker to the resting screen).
  // Switched off: nothing — the display rests until the payment.
  const customerView = tabLoading ? undefined : JSON.stringify(showOrder ? customerViewOrder(m, draft, shownTab, event?.name ?? null, event?.id ?? null) : null)
  useEffect(() => {
    if (customerView === undefined) return
    const timer = setTimeout(() => {
      const order = JSON.parse(customerView) as CustomerOrder | null
      // Newer always higher, also across a reload of the kassa.
      const seq = Math.max(Date.now(), customerViewRef.current.seq + 1)
      customerViewRef.current = { order, seq }
      channelRef.current?.postMessage({ type: 'order-view', order, seq })
      const org = posOrgIdRef.current
      const pos = posTerminalIdRef.current
      if (!org || !pos || customerViewSentRef.current === customerView) return
      customerViewSentRef.current = customerView
      fetch(`/api/organizations/${encodeURIComponent(org)}/devices/${encodeURIComponent(pos)}/customer-view`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, seq }),
      }).catch(() => {
        customerViewSentRef.current = null
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [customerView])

  // Tap to Pay is never confirmed by hand: SumUp does.
  const showConfirmButton = current !== null && current.status !== 'RESOLVED' && current.method !== 'tap'
  const draftKeys = new Set(Object.keys(drafts))
  const shownPanelWidth = clampPanel(panelWidth, viewportWidth)
  const draftCount = draft.reduce((n, l) => n + l.quantity, 0)
  // What the ticket on the right says is to pay (what's open plus the new round).
  const targetCents = (shownTab?.outstandingCents || 0) + draftTotalCents(draft)
  const panelTitle = active === 'quick' ? m.quickTitle : shownTab ? tabTitle(m, shownTab) : m.loading
  const itemCount = draft.reduce((n, l) => n + l.quantity, 0) + (shownTab?.lines || []).filter((l) => !l.voidsLineId).reduce((n, l) => n + netQuantity(l), 0)
  const panelSubtitle = `${active === 'quick' ? m.quickSubtitle : m.openTab} · ${m.items(itemCount)}`
  const draftQuantities = Object.fromEntries(draft.map((l) => [l.variantId, l.quantity]))
  const catalogName = catalogState.status === 'ok' ? catalogState.catalog.name : null

  // The role Bediening works on the waiter screen only (T6).
  if (waiterOnly) return <WaiterOnly />

  // Logging out with the drawer still open: "Kasopmaak doen" or "Openlaten"
  // (DOMAIN_MODEL.md decision 3 — the shift doesn't end with a session).
  function leaveWithOpenDrawer(e: React.MouseEvent) {
    if (!regState?.shift) return
    e.preventDefault()
    setLeaving(true)
  }

  // On a register whose drawer isn't open: "Kassa openen" before anything else.
  const registerClosed = !!orgId && !!getRegister(orgId) && !!regState && !regState.shift

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      {orgId && <DemoBar orgId={orgId} />}
      {/* Header: where this kassa is (org · device · menukaart), who's on it, and the open tabs. */}
      <header className="border-b bg-card">
        <div className="flex flex-wrap items-center gap-3.5 px-5 pt-3 pb-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-foreground text-[11px] font-bold tracking-tight text-background" aria-hidden="true">
              {initials(orgName) || <img src={kabouterLogo} alt="" className="size-4 invert dark:invert-0" />}
            </div>
            <div className="flex min-w-0 flex-col gap-px">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[14.5px] font-semibold tracking-tight">{orgName || m.kassa}</span>
                {event && (
                  <span
                    className="shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold tracking-[0.01em] text-foreground/80"
                    title={m.eventHint}
                    data-testid="kassa-event"
                  >
                    {event.name}
                  </span>
                )}
              </div>
              <span className="truncate text-[11.5px] text-muted-foreground">
                {[getDeviceName(), catalogName && m.catalogNamed(catalogName), terminalIdLabel && `POS ${terminalIdLabel.slice(0, 8)}`].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
          {orgId && <StaffButton orgId={orgId} required={staffRequired} open={staffOpen} onOpenChange={setStaffOpen} className="h-[34px]" />}
          {regState?.shift && (
            <span className="text-[12px] text-muted-foreground" data-testid="shift-label">
              {st.header(regState.register.name, regState.shift.number, new Date(regState.shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
            </span>
          )}
          <div className="min-w-5 flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            {regState?.shift && (
              <>
                <Button variant="outline" className="h-[34px] px-3 text-[13px]" disabled={current !== null} onClick={() => setMovementOpen(true)}>
                  {st.movement}
                </Button>
                <Button variant="outline" className="h-[34px] px-3 text-[13px]" disabled={current !== null} onClick={openCashUp} data-testid="open-cash-up">
                  {st.cashUp}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="h-[34px] px-3 text-[13px]"
              disabled={current !== null}
              aria-pressed={view === 'overview'}
              onClick={() => setView(view === 'overview' ? 'kassa' : 'overview')}
            >
              {view === 'overview' ? m.backToKassa : m.overviewButton}
            </Button>
            <Button variant="outline" className="h-[34px] px-3 text-[13px]" disabled={openingDisplay} onClick={openDisplay}>
              {m.openDisplay}
            </Button>
            <Button
              variant={showOrder ? 'secondary' : 'outline'}
              className="h-[34px] px-3 text-[13px]"
              aria-pressed={showOrder}
              title={m.showOrderHint}
              onClick={() => {
                setShowOrder(!showOrder)
                storeShowOrder(!showOrder)
              }}
              data-testid="show-order"
            >
              {showOrder ? <Eye /> : <EyeOff />}
              {m.showOrder}
            </Button>
            <Button variant="outline" className="h-[34px] px-3 text-[13px]" asChild>
              <a href="/settings.html">{m.settings}</a>
            </Button>
            {user && (
              <div className="flex items-center gap-2 border-l pl-2.5">
                <div className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10.5px] font-semibold text-foreground/75" aria-hidden="true">
                  {initials(user.name)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium">{user.name}</span>
                  <a href="/logout" onClick={leaveWithOpenDrawer} className="text-[10.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    {m.logout}
                  </a>
                </div>
              </div>
            )}
            {!user && (
              <a href="/logout" onClick={leaveWithOpenDrawer} className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
                {m.logout}
              </a>
            )}
          </div>
        </div>
        <div className="px-5 pb-2.5">
          <TabStrip
            tabs={tabs}
            active={active}
            draftKeys={draftKeys}
            quickTotalCents={draftTotalCents(drafts.quick || [])}
            disabled={busy || current !== null}
            onSelect={(key) => {
              setView('kassa')
              selectTab(key)
            }}
            onNew={() => setNameDialog('new')}
            onRefresh={refreshAll}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-6">
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        {notice && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <p>{notice}</p>
            <Button variant="ghost" size="sm" onClick={() => setNotice('')}>
              {m.close}
            </Button>
          </div>
        )}

        {registerClosed && orgId && regState && <OpenRegister orgId={orgId} state={regState} onOpened={() => loadRegister()} />}
        {!registerClosed && cashUpOpen && orgId && regState?.shift && (
          <CashUp
            orgId={orgId}
            state={{ ...regState, shift: regState.shift }}
            onBack={() => setCashUpOpen(false)}
            onClosed={() => {
              setCashUpOpen(false)
              loadRegister()
            }}
          />
        )}
        {orgId && regState?.shift && movementOpen && (
          <MovementDialog orgId={orgId} shift={regState.shift} deviceName={getDeviceName()} onClose={() => setMovementOpen(false)} onSaved={() => loadRegister()} />
        )}
        <Dialog open={leaving} onOpenChange={setLeaving}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.leaveTitle}</DialogTitle>
              <DialogDescription>{m.leaveText}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" asChild>
                <a href="/logout">{m.leaveOpen}</a>
              </Button>
              <Button
                onClick={() => {
                  setLeaving(false)
                  openCashUp()
                }}
              >
                {st.cashUp}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!registerClosed && !cashUpOpen && !current && view === 'overview' && orgId && (
          <TabsOverview
            orgId={orgId}
            refreshSignal={tabsSignal}
            onOpenTab={(tabId) => {
              setView('kassa')
              selectTab(tabId)
            }}
          />
        )}

        {!registerClosed && !cashUpOpen && !current && view === 'kassa' && (
          // Flex like the design, not a grid with an fr track: Safari
          // mis-sized the nested product grid's rows inside that.
          // Ordering on the left, the tab on the right — apart: a line between
          // them, dragged to make the tab wider or narrower (this till's).
          <div className="flex flex-col items-start gap-4 lg:flex-row lg:gap-0" style={{ '--panel': `${shownPanelWidth}px` } as React.CSSProperties}>
            <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-1 lg:pr-2">
              {/* Which tab this order is for — the same tab as the strip's
                  selected one and the panel on the right. */}
              <div className="flex h-12 items-center gap-2.5 overflow-hidden rounded-xl border border-foreground/15 bg-card px-3.5" data-testid="order-target">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{m.orderingFor}</span>
                <span className="min-w-0 truncate rounded-md bg-foreground px-2 py-0.5 text-[13.5px] font-semibold tracking-tight text-background">{active === 'quick' ? m.quickSale : panelTitle}</span>
                {/* The same as the ticket on the right: its items and what's to pay, new ones included. */}
                <span className="ml-auto truncate text-right font-mono text-[12.5px] whitespace-nowrap text-muted-foreground tabular-nums" data-testid="order-target-summary">
                  {m.items(itemCount)} · <span className="font-semibold text-foreground">{formatEuro(targetCents)}</span>
                  {/* On the same line: the header never grows and pushes the menu down. */}
                  {draftCount > 0 && <span> · {m.newItems(draftCount)}</span>}
                </span>
              </div>
              <ItemPicker catalogState={catalogState} quantities={draftQuantities} onTab={tabQuantities(shownTab)} disabled={busy || tabLoading || !!shownTab?.paymentPending || (!!itemMode && itemMode.tabId === shownTab?.id)} onAdd={addItem} onRemove={removeItem} />
            </div>
            <PanelDivider
              width={shownPanelWidth}
              min={PANEL_MIN}
              max={panelMax(viewportWidth)}
              label={m.panelDivider}
              onChange={(w) => {
                setPanelWidth(w)
                writePanelWidth(w)
              }}
              onReset={() => {
                setPanelWidth(PANEL_DEFAULT)
                writePanelWidth(null)
              }}
            />
            <div className="w-full border-t-2 pt-4 lg:w-[var(--panel)] lg:shrink-0 lg:self-stretch lg:border-t-0 lg:pt-0 lg:pl-2" data-testid="tab-side">
            <div className="flex flex-col gap-3 lg:sticky lg:top-4">
              {kassaModes.length > 1 && (
                <div className="flex flex-col gap-1.5" role="group" aria-label={m.orderMode} data-testid="kassa-modes">
                  <span className="text-[11.5px] font-medium text-muted-foreground">{m.orderMode}</span>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(kassaModes.length, 3)}, minmax(0, 1fr))` }}>
                    {kassaModes.map((mode) => (
                      <Button
                        key={mode.id}
                        variant={mode.id === orderModeId ? 'default' : 'outline'}
                        className="h-10 truncate"
                        aria-pressed={mode.id === orderModeId}
                        disabled={busy || current !== null}
                        onClick={() => setOrderModeId(mode.id)}
                      >
                        {mode.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <TabPanel
                title={panelTitle}
                subtitle={panelSubtitle}
                tab={shownTab}
                draft={draft}
                paymentMethod={paymentMethod}
                tapToPay={tapToPay}
                tipInput={tipInput}
                onTipInputChange={setTipInput}
                busy={busy || tabLoading}
                onPaymentMethodChange={setPaymentMethod}
                onDraftQuantity={setDraftQuantity}
                onClearDraft={() => setDraftFor(active, [])}
                onVoid={setVoidTarget}
                onPay={pay}
                onPark={() => setNameDialog('park')}
                onRename={() => setNameDialog('rename')}
                onCancelTab={cancelEmptyTab}
                onCancelTicket={() => setCancellingTicket(true)}
                onRefresh={refreshAll}
                onSplit={() => setSplitDialogOpen(true)}
                onStopSplit={stopSplit}
                itemSelection={itemMode && shownTab && itemMode.tabId === shownTab.id ? itemMode.selection : null}
                onItemSelection={(selection) => setItemMode((m) => (m ? { ...m, selection } : m))}
                onStopItems={() => setItemMode(null)}
              />
            </div>
            </div>
          </div>
        )}

        {current && (
          <div className="flex flex-1 items-start justify-center pt-6">
            <PaymentStatus
              current={current}
              manualStatus={manualStatus}
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
        title={nameDialog === 'rename' ? m.rename : nameDialog === 'park' ? m.park : m.newTabTitle}
        description={nameDialog === 'park' ? m.parkDescription : undefined}
        confirmLabel={nameDialog === 'rename' ? m.save : m.openTabButton}
        initialValue={nameDialog === 'rename' ? shownTab?.label || '' : ''}
        onConfirm={confirmNameDialog}
        onClose={() => setNameDialog(null)}
      />
      <SplitDialog
        key={splitDialogOpen ? 'open' : 'closed'}
        open={splitDialogOpen}
        openCents={(shownTab?.outstandingCents || 0) + draftTotalCents(draft)}
        onConfirm={startSplit}
        onItems={startItems}
        onClose={() => setSplitDialogOpen(false)}
      />
      <VoidDialog key={voidTarget?.id ?? 'closed'} line={voidTarget} onConfirm={confirmVoid} onClose={() => setVoidTarget(null)} />
      <CancelTicketDialog
        key={cancellingTicket ? `cancel-${shownTab?.id}` : 'closed'}
        open={cancellingTicket && !!shownTab}
        items={(shownTab?.lines || []).filter((l) => !l.voidsLineId).reduce((n, l) => n + netQuantity(l), 0)}
        amount={formatEuro(shownTab?.totalCents ?? 0)}
        onConfirm={confirmCancelTicket}
        onClose={() => setCancellingTicket(false)}
      />
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
