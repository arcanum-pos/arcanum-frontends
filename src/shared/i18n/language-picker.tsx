import { cn } from 'cn'
import { LOCALES, storeLocale, useLocale, type Locale, type Messages } from '.'

// Each language named in itself, so whoever needs it can find it.
const NAMES: Record<Locale, string> = { nl: 'Nederlands', fr: 'Français', en: 'English' }
const GROUP_LABEL: Messages<string> = { nl: 'Taal', fr: 'Langue', en: 'Language' }

// NL · FR · EN. `persist` makes the pick this device's language (see
// storedLocale); without it (the customer display) it only lasts until the
// screen resets.
export function LanguagePicker({ persist = false, className }: { persist?: boolean; className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div role="group" aria-label={GROUP_LABEL[locale]} className={cn('flex gap-1', className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={NAMES[l]}
          title={NAMES[l]}
          aria-pressed={l === locale}
          onClick={() => {
            setLocale(l)
            if (persist) storeLocale(l)
          }}
          className={cn(
            'rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground uppercase transition-opacity',
            l === locale ? 'opacity-100' : 'opacity-50 hover:opacity-100'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
