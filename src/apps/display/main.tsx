import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/globals.css'
import { DEFAULT_LOCALE, storedLocale } from '@/shared/i18n'
import { LocaleProvider } from '@/shared/i18n/locale-provider'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The device's language if one was picked on the chooser — never the
        browser's: a kiosk browser's own setting says nothing about the
        customers in front of it. */}
    <LocaleProvider initial={storedLocale() ?? DEFAULT_LOCALE}>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
