import type { ReactNode } from 'react'
import { ADMIN_THEME_KEY } from '@/shared/theme'
import { ThemeProvider as SharedThemeProvider } from '@/shared/theme-provider'

// The console's own theme (ADMIN_THEME_KEY) — the logic is shared with the
// kiosk screens (src/shared/theme.ts).
export { useTheme } from '@/shared/theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <SharedThemeProvider storageKey={ADMIN_THEME_KEY}>{children}</SharedThemeProvider>
}
