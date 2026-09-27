import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_LOCALE, LocaleContext, type Locale } from '.'

export function LocaleProvider({ initial = DEFAULT_LOCALE, children }: { initial?: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initial)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}
