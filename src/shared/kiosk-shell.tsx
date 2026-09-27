import type { ReactNode } from 'react'
import { AppBrand } from './app-brand'
import { LanguagePicker } from './i18n/language-picker'
import { ThemePicker } from './theme-picker'

// Full-viewport centered shell shared by the pre-login/kiosk-facing screens
// (login-prompt, device, chooser) — none of these run inside the admin
// app's sidebar layout, so they get their own minimal chrome instead.
// `devicePickers`: the language and theme pickers (inside a LocaleProvider
// and ThemeProvider) — what's picked becomes this device's language/theme.
export function KioskShell({ children, maxWidth = 'max-w-sm', devicePickers = false }: { children: ReactNode; maxWidth?: string; devicePickers?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6 text-foreground">
      {devicePickers && (
        <div className="fixed top-4 right-4 flex items-center gap-3">
          <ThemePicker />
          <LanguagePicker persist />
        </div>
      )}
      <AppBrand className="text-2xl" />
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  )
}
