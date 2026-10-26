import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/globals.css'
import { deviceLocale } from '@/shared/i18n'
import { LocaleProvider } from '@/shared/i18n/locale-provider'
import { DEVICE_THEME_KEY } from '@/shared/theme'
import { ThemeProvider } from '@/shared/theme-provider'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey={DEVICE_THEME_KEY}>
      <LocaleProvider initial={deviceLocale()}>
        <App />
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
