// The device identity a browser keeps (arcanum-terminal): a role this app no
// longer has — the SumUp simulator's 'sim', removed 2026-10-06 — counts as
// not registered, so the chooser asks again instead of opening a page that's gone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimPairingCode, getRegisteredTerminal, getStoredTerminalInfo } from './terminal'

function stored(value: unknown) {
  const items: Record<string, string> = { 'arcanum-terminal': JSON.stringify(value) }
  vi.stubGlobal('localStorage', { getItem: (k: string) => items[k] ?? null, setItem() {}, removeItem() {} })
}

afterEach(() => vi.unstubAllGlobals())

describe('getStoredTerminalInfo', () => {
  it('returns a kassa or customer display as stored', () => {
    for (const role of ['pos', 'cfd']) {
      stored({ terminalId: 't1', role, orgId: 'o1' })
      expect(getStoredTerminalInfo()).toEqual({ terminalId: 't1', role, orgId: 'o1' })
    }
  })

  it('treats a former simulator (or anything unknown) as not registered', () => {
    for (const role of ['sim', 'other', undefined]) {
      stored({ terminalId: 't1', role, orgId: 'o1' })
      expect(getStoredTerminalInfo(), String(role)).toBeNull()
    }
  })

  it('nothing stored: not registered', () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    expect(getStoredTerminalInfo()).toBeNull()
  })
})

describe('getRegisteredTerminal', () => {
  const pos = { terminalId: 't1', role: 'pos', orgId: 'o1', orgName: 'Scouts' }
  function storage(value: unknown) {
    const items: Record<string, string> = { 'arcanum-terminal': JSON.stringify(value) }
    const store = { getItem: (k: string) => items[k] ?? null, setItem: (k: string, v: string) => (items[k] = v), removeItem: (k: string) => delete items[k] }
    vi.stubGlobal('localStorage', store)
    return items
  }

  it("asks the organisation about this device, and keeps it when it's known", async () => {
    storage(pos)
    const fetchMock = vi.fn(async () => Response.json({ terminal_id: 't1' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getRegisteredTerminal('pos')).toEqual(pos)
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/o1/devices/t1', expect.anything())
  })

  it('removed in the console (404) or no longer a member (403): forgotten', async () => {
    for (const status of [404, 403]) {
      const items = storage(pos)
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'device_not_found' }, { status })))
      expect(await getRegisteredTerminal('pos'), String(status)).toBeNull()
      expect(items['arcanum-terminal'], String(status)).toBeUndefined()
    }
  })

  it('offline: keeps the stored device (keep selling)', async () => {
    storage(pos)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await getRegisteredTerminal('pos')).toEqual(pos)
  })

  it('another role than asked for: not this page’s device', async () => {
    storage(pos)
    vi.stubGlobal('fetch', vi.fn())
    expect(await getRegisteredTerminal('cfd')).toBeNull()
  })
})

describe('claimPairingCode', () => {
  it('stores the claimed device and its name', async () => {
    const items: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => items[k] ?? null, setItem: (k: string, v: string) => (items[k] = v), removeItem: (k: string) => delete items[k] })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ terminalId: 't9', role: 'cfd', orgId: 'o1', orgName: 'Scouts', orgLocale: 'fr', name: 'Scherm' }, { status: 201 })))
    const device = await claimPairingCode('k7pm-4xq2')
    expect(device.orgLocale).toBe('fr')
    expect(JSON.parse(items['arcanum-terminal'])).toEqual({ terminalId: 't9', role: 'cfd', orgId: 'o1', orgName: 'Scouts', name: 'Scherm' })
    expect(JSON.parse(items['arcanum-device']).name).toBe('Scherm')
  })

  it('a refused code throws the reason and stores nothing', async () => {
    const items: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => items[k] ?? null, setItem: (k: string, v: string) => (items[k] = v), removeItem: (k: string) => delete items[k] })
    vi.stubGlobal('document', { documentElement: { lang: 'en' } })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'x', code: 'pairing_code_invalid' }, { status: 400 })))
    await expect(claimPairingCode('nope')).rejects.toThrow('This pairing code is wrong')
    expect(items['arcanum-terminal']).toBeUndefined()
  })
})
