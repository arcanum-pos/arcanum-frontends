import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/globals.css'
import { ADMIN_LOCALE_KEY, preferredLocale } from '@/shared/i18n'
import { LocaleProvider } from '@/shared/i18n/locale-provider'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider initial={preferredLocale(ADMIN_LOCALE_KEY)}>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
