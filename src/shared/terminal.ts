// Local counterpart of arcanum-webapp's src/lib/terminal.ts (device-identity
// storage + notification channel) — only the pieces the chooser/device/
// simulator screens need (not the kassa-Settings-only link/unlink helpers,
// which stay in arcanum-webapp until kassa itself migrates). kassa/display/
// simulator's *webapp* copy still reads/writes this same localStorage key,
// so the key and stored shape must stay byte-for-byte compatible.

export type Role = 'pos' | 'cfd' | 'sim'

export const PAGE_FOR_ROLE: Record<Role, string> = {
  pos: '/kassa.html',
  cfd: '/display.html',
  sim: '/simulator.html',
}

const DEVICES_URL = '/api/devices'

export interface Terminal {
  terminalId: string
  role: Role
  orgId: string
  orgName?: string
}

const TERMINAL_KEY = 'questo-terminal'

function getStoredTerminal(): Terminal | null {
  try {
    return JSON.parse(localStorage.getItem(TERMINAL_KEY) || 'null')
  } catch {
    return null
  }
}

export function getStoredTerminalInfo(): Terminal | null {
  return getStoredTerminal()
}

async function callRegister(terminal: Terminal): Promise<void> {
  try {
    const res = await fetch(`${DEVICES_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminal_id: terminal.terminalId, role: terminal.role, org_id: terminal.orgId }),
    })
    if (!res.ok) console.error(`Kon toestel niet registreren: ${res.status} ${await res.text().catch(() => '')}`)
  } catch (err) {
    console.error('Kon toestel niet registreren (netwerkfout)', err)
  }
}

// Called only by the chooser, once it has determined both a role and an
// organization — establishes this browser's device identity.
export async function registerNewTerminal(role: Role, orgId: string, orgName?: string): Promise<void> {
  const terminal: Terminal = { terminalId: crypto.randomUUID(), role, orgId, orgName }
  localStorage.setItem(TERMINAL_KEY, JSON.stringify(terminal))
  await callRegister(terminal)
}

// Called by a target page (e.g. simulator) on load. Re-confirms the
// already-stored identity with the server (idempotent) but never invents
// one — if nothing's stored yet, or it's stored under a different role,
// returns null so the caller can send them back to the chooser instead of
// registering blind with no organization.
export async function getRegisteredTerminal(expectedRole: Role): Promise<Terminal | null> {
  const stored = getStoredTerminal()
  if (!stored || stored.role !== expectedRole || !stored.orgId) return null
  await callRegister(stored)
  return stored
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
export function connectNotifications(terminalId: string, handlers: NotificationHandlers): NotificationSocket {
  let socket: WebSocket | null = null
  let retryDelayMs = 1000
  let stopped = false

  async function connect() {
    if (stopped) return
    try {
      const res = await fetch(`${DEVICES_URL}/ws-token?terminal_id=${encodeURIComponent(terminalId)}`)
      if (!res.ok) throw new Error(`ws-token request failed (${res.status})`)
      const { token, wsUrl } = (await res.json()) as { token: string; wsUrl: string }

      socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)

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
