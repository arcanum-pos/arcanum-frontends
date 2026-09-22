// Local counterpart of arcanum-webapp's src/lib/terminal.ts (device-identity
// storage) and src/lib/organizations.ts (membership lookup) — only the
// pieces the chooser itself needs (generate + register a new terminal, list
// the caller's memberships). kassa/display/simulator still read/reconfirm
// this same localStorage key from arcanum-webapp; this repo never touches
// those pages, so the key and stored shape must stay byte-for-byte
// compatible with arcanum-webapp's Terminal type.

export type Role = 'pos' | 'cfd' | 'sim'

export const PAGE_FOR_ROLE: Record<Role, string> = {
  pos: '/kassa.html',
  cfd: '/display.html',
  sim: '/simulator.html',
}

interface Terminal {
  terminalId: string
  role: Role
  orgId: string
  orgName?: string
}

const TERMINAL_KEY = 'questo-terminal'

export function getStoredTerminalInfo(): Terminal | null {
  try {
    return JSON.parse(localStorage.getItem(TERMINAL_KEY) || 'null')
  } catch {
    return null
  }
}

export async function registerNewTerminal(role: Role, orgId: string, orgName?: string): Promise<void> {
  const terminal: Terminal = { terminalId: crypto.randomUUID(), role, orgId, orgName }
  localStorage.setItem(TERMINAL_KEY, JSON.stringify(terminal))
  try {
    const res = await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminal_id: terminal.terminalId, role: terminal.role, org_id: terminal.orgId }),
    })
    if (!res.ok) console.error(`Kon toestel niet registreren: ${res.status} ${await res.text().catch(() => '')}`)
  } catch (err) {
    console.error('Kon toestel niet registreren (netwerkfout)', err)
  }
}

export interface Membership {
  orgId: string
  orgName: string
  role: 'admin' | 'cashier'
}

export async function listMyMemberships(): Promise<Membership[]> {
  const res = await fetch('/api/organizations/memberships', { headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `status ${res.status}`)
  return data as Membership[]
}
