import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/globals.css'
import { LocaleProvider } from '@/shared/i18n/locale-provider'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
