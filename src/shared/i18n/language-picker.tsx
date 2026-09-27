import { cn } from 'cn'
import { LOCALES, storeLocale, useLocale, type Locale, type Messages } from '.'

// Each language named in itself, so whoever needs it can find it.
const NAMES: Record<Locale, string> = { nl: 'Nederlands', fr: 'Français', en: 'English' }
const GROUP_LABEL: Messages<string> = { nl: 'Taal', fr: 'Langue', en: 'Language' }

// NL · FR · EN. `persist` makes the pick this device's language (see
// storedLocale); without it (the customer display) it only lasts until the
// screen resets. `inverted` for a dark screen on a light theme.
export function LanguagePicker({ persist = false, inverted = false, className }: { persist?: boolean; inverted?: boolean; className?: string }) {
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
            'rounded-lg px-2.5 py-1 text-xs font-semibold uppercase transition-opacity',
            l === locale ? 'opacity-100' : 'opacity-50 hover:opacity-100',
            inverted ? 'bg-neutral-800 text-neutral-200' : 'bg-secondary text-secondary-foreground'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
