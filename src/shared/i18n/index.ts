import { createContext, useContext } from 'react'

// Interface translations: Dutch (the source of truth), French, English.
//
// No i18n library and no string keys: a screen's messages are plain typed
// objects, one per locale (src/apps/<name>/messages/{nl,fr,en}.ts), with
// fr/en declared `satisfies` the nl one's type — a missing or misspelled
// message is a type error, not a raw key on screen. Interpolation and
// plurals are just functions, so each language words them its own way.
// Only the screen that imports a message set ships it.
//
// Amounts keep formatEuro's Belgian "€ 10,00" in every language, so the
// customer display always matches the kassa.
export const LOCALES = ['nl', 'fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'nl'

export type Messages<T> = Record<Locale, T>

// Provided by LocaleProvider (./locale-provider.tsx) at a screen's root.
export const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
})

export function useLocale() {
  return useContext(LocaleContext)
}

export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale().locale]
}
