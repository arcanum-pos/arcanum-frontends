import type { ReactNode } from 'react'
import { AppBrand } from './app-brand'

// Full-viewport centered shell shared by the pre-login/kiosk-facing screens
// (login-prompt, device, chooser) — none of these run inside the admin
// app's sidebar layout, so they get their own minimal chrome instead.
export function KioskShell({ children, maxWidth = 'max-w-sm' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6 text-foreground">
      <AppBrand className="text-2xl" />
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  )
}
