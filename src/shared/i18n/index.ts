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
// The admin console keeps its own (ADMIN_LOCALE_KEY): it's a person's
// choice in their own browser, which may well be a kassa's too.
const STORAGE_KEY = 'arcanum-locale'
export const ADMIN_LOCALE_KEY = 'arcanum-admin-locale'

export function storedLocale(key = STORAGE_KEY): Locale | null {
  try {
    const value = localStorage.getItem(key)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, locale)
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
// language, else the browser's, else Dutch. The admin console the same,
// from its own key (ADMIN_LOCALE_KEY).
export function preferredLocale(key = STORAGE_KEY): Locale {
  return storedLocale(key) ?? browserLocale() ?? DEFAULT_LOCALE
}

// A kiosk screen with customers or cashiers in front of it (kassa,
// Instellingen, the customer display): the device's picked language, else
// Dutch — never the browser's, which says nothing about who uses the device.
export function deviceLocale(): Locale {
  return storedLocale() ?? DEFAULT_LOCALE
}

// The language the screen is showing right now (LocaleProvider keeps
// <html lang> in sync) — for code outside React, e.g. an API client
// wording an error. Dutch before a provider has run.
export function currentLocale(): Locale {
  const lang = typeof document === 'undefined' ? null : document.documentElement.lang
  return isLocale(lang) ? lang : DEFAULT_LOCALE
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
