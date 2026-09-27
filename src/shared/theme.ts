import { createContext, useContext } from 'react'

// Light / dark / follow the system, as a `.dark` class on <html> (see
// globals.css's @custom-variant dark). Two separate choices: a device's
// (DEVICE_THEME_KEY — the kassa, Instellingen, the customer display, the
// setup screens) and the admin console's own (ADMIN_THEME_KEY), for the
// same reason the language is kept apart (a laptop can be both).
export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]
export const DEVICE_THEME_KEY = 'arcanum-theme'
export const ADMIN_THEME_KEY = 'arcanum-admin-theme'

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value)
}

// 'system' until one is picked; blocked storage just means "not picked".
export function storedTheme(key: string): Theme {
  try {
    const value = localStorage.getItem(key)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(key: string, theme: Theme) {
  try {
    localStorage.setItem(key, theme)
  } catch {
    // Not remembered — the screen still switches.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

// Provided by ThemeProvider (./theme-provider.tsx) at a screen's root.
export const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
