import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/globals.css'
import { preferredLocale } from '@/shared/i18n'
import { LocaleProvider } from '@/shared/i18n/locale-provider'
import { ThemeProvider } from '@/shared/theme-provider'
import App from './App.tsx'

// A guest's own phone: its browser's language (or one picked here), its
// own light/dark setting.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="arcanum-selforder-theme">
      <LocaleProvider initial={preferredLocale()}>
        <App />
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
