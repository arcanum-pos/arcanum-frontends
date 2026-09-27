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

// For Intl date/number formatting — Belgian conventions in each language.
export const INTL_LOCALES: Record<Locale, string> = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-BE' }

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value)
}

// This device's language, as last picked with a kiosk screen's
// LanguagePicker (chooser, login, device login) — also the customer
// display's home language. A private window or blocked storage just means
// "not picked".
const STORAGE_KEY = 'arcanum-locale'

export function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Not remembered — the screen still switches.
  }
}

// The browser's first preferred language we speak ("fr-BE" → fr), if any.
export function browserLocale(): Locale | null {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return null
}

// A kiosk screen with no customer in front of it: this device's picked
// language, else the browser's, else Dutch.
export function preferredLocale(): Locale {
  return storedLocale() ?? browserLocale() ?? DEFAULT_LOCALE
}

// A kiosk screen with customers or cashiers in front of it (kassa,
// Instellingen, the customer display): the device's picked language, else
// Dutch — never the browser's, which says nothing about who uses the device.
export function deviceLocale(): Locale {
  return storedLocale() ?? DEFAULT_LOCALE
}

// Provided by LocaleProvider (./locale-provider.tsx) at a screen's root.
// resetLocale goes back to the language the screen started in.
export const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; resetLocale: () => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  resetLocale: () => {},
})

export function useLocale() {
  return useContext(LocaleContext)
}

export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale().locale]
}
