import { useEffect, useState } from 'react'

// This kassa's own look (KASSA_REDESIGN.md, "Aanpassen"): kept on the device,
// like its layout and its divider - screens and cashiers differ. Read once
// per render through useKassaPrefs; changed in the Aanpassen sheet.
export type TileSize = 'large' | 'compact' | 'list'
export type TextSize = 'small' | 'normal' | 'large'

export interface KassaPrefs {
  // Product buttons: big tiles, compact tiles (the default: more on screen), or a list.
  tiles: TileSize
  // The ticket on the right (default) or on the left.
  side: 'right' | 'left'
  text: TextSize
  // The counts on the product buttons (3× on the tab, +1 new).
  counts: boolean
  // The tip buttons next to Afrekenen.
  tipButtons: boolean
}

export const DEFAULT_PREFS: KassaPrefs = { tiles: 'compact', side: 'right', text: 'normal', counts: true, tipButtons: true }

const KEY = 'arcanum-kassa-prefs'
const EVENT = 'arcanum-kassa-prefs'

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? (value as T) : fallback)

export function readPrefs(): KassaPrefs {
  let raw: Record<string, unknown> = {}
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || '{}') ?? {}
  } catch {
    raw = {}
  }
  return {
    tiles: pick(raw.tiles, ['large', 'compact', 'list'] as const, DEFAULT_PREFS.tiles),
    side: pick(raw.side, ['right', 'left'] as const, DEFAULT_PREFS.side),
    text: pick(raw.text, ['small', 'normal', 'large'] as const, DEFAULT_PREFS.text),
    counts: typeof raw.counts === 'boolean' ? raw.counts : DEFAULT_PREFS.counts,
    tipButtons: typeof raw.tipButtons === 'boolean' ? raw.tipButtons : DEFAULT_PREFS.tipButtons,
  }
}

// null: back to the defaults.
export function writePrefs(prefs: KassaPrefs | null) {
  try {
    if (prefs) localStorage.setItem(KEY, JSON.stringify(prefs))
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: this page keeps them until it's closed.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useKassaPrefs(): KassaPrefs {
  const [prefs, setPrefs] = useState(readPrefs)
  useEffect(() => {
    const update = () => setPrefs(readPrefs())
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return prefs
}

// A menu group's colour, by its place in the menu (decision 2: automatic, a
// fixed palette). Dark enough for white text on it (WCAG AA, ≥ 4.5:1); the
// group's box is a light tint of it. Never the only cue: the name stays.
const GROUP_COLORS = ['#2563eb', '#c2410c', '#be185d', '#15803d', '#7c3aed', '#0f766e', '#b45309', '#4f46e5']

export const groupColor = (index: number) => GROUP_COLORS[((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length]
