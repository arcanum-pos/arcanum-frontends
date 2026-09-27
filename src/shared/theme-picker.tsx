import { Laptop, Moon, Sun } from 'lucide-react'
import { cn } from 'cn'
import { useMessages, type Messages } from './i18n'
import { THEMES, useTheme, type Theme } from './theme'

const LABELS: Messages<Record<Theme, string> & { group: string }> = {
  nl: { group: 'Weergave', light: 'Licht', dark: 'Donker', system: 'Systeem' },
  fr: { group: 'Apparence', light: 'Clair', dark: 'Sombre', system: 'Système' },
  en: { group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' },
}
const ICONS = { light: Sun, dark: Moon, system: Laptop }

// Light · dark · system, next to the LanguagePicker on the kiosk screens.
// `withLabels` shows the words too (Instellingen); otherwise icons only,
// named for screen readers.
export function ThemePicker({ withLabels = false, className }: { withLabels?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme()
  const t = useMessages(LABELS)
  return (
    <div role="group" aria-label={t.group} className={cn('flex gap-1', className)}>
      {THEMES.map((option) => {
        const Icon = ICONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-label={withLabels ? undefined : t[option]}
            title={t[option]}
            aria-pressed={theme === option}
            onClick={() => setTheme(option)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-opacity',
              theme === option ? 'opacity-100 ring-1 ring-foreground/20' : 'opacity-50 hover:opacity-100'
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {withLabels && t[option]}
          </button>
        )
      })}
    </div>
  )
}
