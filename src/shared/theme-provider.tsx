import { useLayoutEffect, useState, type ReactNode } from 'react'
import { applyTheme, storedTheme, storeTheme, ThemeContext, type Theme } from './theme'

// `storageKey`: DEVICE_THEME_KEY or ADMIN_THEME_KEY (see ./theme.ts).
export function ThemeProvider({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme(storageKey))

  // Before the first paint, so a dark screen never flashes light.
  useLayoutEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    // Follow the OS preference live while "system" is selected.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyTheme('system')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])

  function setTheme(next: Theme) {
    storeTheme(storageKey, next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
