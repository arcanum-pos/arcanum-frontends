import { Check, Laptop, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useMessages } from '@/shared/i18n'
import { useTheme } from '../../lib/theme'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

const OPTIONS = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Laptop },
] as const

export default function AppearancePage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.settingsNav.appearance}</h2>
        <p className="text-sm text-muted-foreground">{m.appearanceSubtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.theme}</CardTitle>
          <CardDescription>{m.themeRemembered}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent',
                  theme === option.value && 'border-primary bg-accent'
                )}
              >
                {theme === option.value && <Check className="absolute top-2 right-2 size-4 text-primary" />}
                <option.icon className="size-5" />
                {m.themes[option.value]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
