// This browser's device identity (`arcanum-terminal`) and the calls about
// devices: pairing, checking itself, customer-display links — all through
// arcanum-backend (/api/organizations/:org/devices…, which checks who's
// asking). Only the notification socket's token comes from devicehub.
// DOMAIN_MODEL.md "Devices: control plane and data plane".

import { apiErrorMessage } from '@/shared/api-errors'
import { setDeviceName } from '@/shared/device'

export type Role = 'pos' | 'cfd'

export const PAGE_FOR_ROLE: Record<Role, string> = {
  pos: '/kassa.html',
  cfd: '/display.html',
}

const DEVICES_URL = '/api/devices'

export interface Terminal {
  terminalId: string
  role: Role
  orgId: string
  orgName?: string
  // From the pairing code (older devices have none).
  name?: string
}

const TERMINAL_KEY = 'arcanum-terminal'

function getStoredTerminal(): Terminal | null {
  try {
    return JSON.parse(localStorage.getItem(TERMINAL_KEY) || 'null')
  } catch {
    return null
  }
}

// A role this app no longer has (the SumUp simulator's 'sim', removed
// 2026-10-06 — SumUp's Virtual Solo replaces it) counts as not registered:
// the start page asks again.
export function getStoredTerminalInfo(): Terminal | null {
  const stored = getStoredTerminal()
  return stored && stored.role in PAGE_FOR_ROLE ? stored : null
}

export function forgetTerminal(): void {
  localStorage.removeItem(TERMINAL_KEY)
}

const devicesPath = (orgId: string, suffix = '') => `/api/organizations/${encodeURIComponent(orgId)}/devices${suffix}`

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(apiErrorMessage(data, `status ${res.status}`)), { status: res.status, code: data?.code })
  return data as T
}

export interface ClaimedDevice {
  terminalId: string
  role: Role
  orgId: string
  orgName: string
  orgLocale: string | null
  name: string
}

// "Dit toestel koppelen": claims the code an admin made in the console;
// this browser becomes that device (its role, organisation and name).
export async function claimPairingCode(code: string): Promise<ClaimedDevice> {
  const device = await call<ClaimedDevice>('/api/organizations/device-pairings/claim', { method: 'POST', body: JSON.stringify({ code }) })
  const terminal: Terminal = { terminalId: device.terminalId, role: device.role, orgId: device.orgId, orgName: device.orgName, name: device.name }
  localStorage.setItem(TERMINAL_KEY, JSON.stringify(terminal))
  setDeviceName(device.name)
  return device
}

// Called by a device page (kassa, customer display, Instellingen) on load:
// the stored identity, if it has this role and the organisation still
// knows it. Removed in the console (or never paired) → null, and the
// stored identity is forgotten, so the caller sends the browser to the
// start page. Offline → the stored identity as is (keep selling).
export async function getRegisteredTerminal(expectedRole: Role): Promise<Terminal | null> {
  const stored = getStoredTerminalInfo()
  if (!stored || stored.role !== expectedRole || !stored.orgId) return null
  try {
    await call(devicesPath(stored.orgId, `/${encodeURIComponent(stored.terminalId)}`))
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404 || status === 403) {
      forgetTerminal()
      return null
    }
  }
  return stored
}

// Unpairs this browser (admins only — the backend refuses anyone else).
export async function unpairThisDevice(): Promise<void> {
  const stored = getStoredTerminalInfo()
  if (stored) await call(devicesPath(stored.orgId, `/${encodeURIComponent(stored.terminalId)}`), { method: 'DELETE' })
  forgetTerminal()
}

// Renames this device in the organisation's list (the console's Toestellen).
export async function renameDevice(orgId: string, terminalId: string, name: string): Promise<void> {
  await call(devicesPath(orgId, `/${encodeURIComponent(terminalId)}`), { method: 'PATCH', body: JSON.stringify({ name }) })
}

// The kassa's "Klantscherm openen": a customer display for a second window
// of this kassa, registered and linked by the backend (replacing the one
// it had). Returns its terminal id, handed to the window in its URL.
export async function openCompanionDisplay(orgId: string, posTerminalId: string): Promise<string> {
  const { terminalId } = await call<{ terminalId: string }>(devicesPath(orgId, `/${encodeURIComponent(posTerminalId)}/display`), { method: 'POST' })
  return terminalId
}

export async function getLinkedDevice(orgId: string, posTerminalId: string): Promise<{ terminal_id: string; name?: string | null } | null> {
  try {
    return await call<{ terminal_id: string; name?: string | null } | null>(devicesPath(orgId, `/${encodeURIComponent(posTerminalId)}/linked`))
  } catch {
    return null
  }
}

export async function listLinkableDisplays(orgId: string, posTerminalId: string): Promise<{ terminal_id: string; name?: string | null }[]> {
  return call(devicesPath(orgId, `/${encodeURIComponent(posTerminalId)}/linkable`))
}

export async function linkTerminals(orgId: string, posTerminalId: string, terminalId: string): Promise<void> {
  await call(devicesPath(orgId, `/${encodeURIComponent(posTerminalId)}/link`), { method: 'POST', body: JSON.stringify({ terminalId }) })
}

export async function unlinkTerminal(orgId: string, terminalId: string): Promise<void> {
  await call(devicesPath(orgId, `/${encodeURIComponent(terminalId)}/unlink`), { method: 'POST' })
}

// Tells the kassa and its customer display to start over (after a payment).
export async function resetKassa(orgId: string, posTerminalId: string): Promise<void> {
  await call(devicesPath(orgId, `/${encodeURIComponent(posTerminalId)}/reset`), { method: 'POST' })
}

export type NotificationHandlers = Record<string, (msg: Record<string, any>) => void>

export interface NotificationSocket {
  close(): void
}

// Opens the notification socket and dispatches incoming {event, ...}
// messages to handlers[event]. Reconnects with backoff on close/error;
// never throws. Never carries real data (no amounts, no QR payloads) — only
// an event name + id; reacting to an event always means calling back
// through the BFF, never trusting anything read off the socket directly.
//
// Connects to this same origin's /devices/connect (arcanum-bff forwards it
// to arcanum-devicehub via a service binding) rather than a separate
// devicehub hostname — so the notification channel follows whatever address
// the instance is on (its custom domain or workers.dev), with no extra
// configuration.
export function connectNotifications(terminalId: string, handlers: NotificationHandlers): NotificationSocket {
  let socket: WebSocket | null = null
  let retryDelayMs = 1000
  let stopped = false

  async function connect() {
    if (stopped) return
    try {
      const res = await fetch(`${DEVICES_URL}/ws-token?terminal_id=${encodeURIComponent(terminalId)}`)
      if (!res.ok) throw new Error(`ws-token request failed (${res.status})`)
      const { token } = (await res.json()) as { token: string }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${wsProtocol}//${window.location.host}/devices/connect?token=${encodeURIComponent(token)}`)

      socket.onopen = () => {
        retryDelayMs = 1000
      }

      socket.onmessage = (event) => {
        let msg: Record<string, any>
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }
        const handler = msg && handlers[msg.event]
        if (handler) handler(msg)
      }

      socket.onclose = scheduleReconnect
      socket.onerror = () => socket?.close()
    } catch (err) {
      console.error('Kon meldingskanaal niet verbinden', err)
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (stopped) return
    setTimeout(connect, retryDelayMs)
    retryDelayMs = Math.min(retryDelayMs * 2, 30000)
  }

  connect()

  return {
    close() {
      stopped = true
      socket?.close()
    },
  }
}
