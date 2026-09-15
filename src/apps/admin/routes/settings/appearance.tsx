import { Check, Laptop, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTheme } from '../../lib/theme'

const OPTIONS = [
  { value: 'light', label: 'Licht', icon: Sun },
  { value: 'dark', label: 'Donker', icon: Moon },
  { value: 'system', label: 'Systeem', icon: Laptop },
] as const

export default function AppearancePage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">Kies een licht of donker thema, of volg je systeeminstelling.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thema</CardTitle>
          <CardDescription>Wordt onthouden op dit toestel.</CardDescription>
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
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
