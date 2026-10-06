// The device identity a browser keeps (arcanum-terminal): a role this app no
// longer has — the SumUp simulator's 'sim', removed 2026-10-06 — counts as
// not registered, so the chooser asks again instead of opening a page that's gone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStoredTerminalInfo } from './terminal'

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
