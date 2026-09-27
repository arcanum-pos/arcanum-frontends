import type { ReactNode } from 'react'
import { AppBrand } from './app-brand'
import { LanguagePicker } from './i18n/language-picker'

// Full-viewport centered shell shared by the pre-login/kiosk-facing screens
// (login-prompt, device, chooser) — none of these run inside the admin
// app's sidebar layout, so they get their own minimal chrome instead.
// `languagePicker` for a translated screen (inside a LocaleProvider): the
// pick becomes this device's language.
export function KioskShell({ children, maxWidth = 'max-w-sm', languagePicker = false }: { children: ReactNode; maxWidth?: string; languagePicker?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6 text-foreground">
      {languagePicker && <LanguagePicker persist className="fixed top-4 right-4" />}
      <AppBrand className="text-2xl" />
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  )
}
