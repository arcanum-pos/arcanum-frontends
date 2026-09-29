import { Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { useOrg } from '../lib/org-context'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// A demo org (is_locked = 'N') disappears automatically (arcanum-cleaner):
// say when, and offer the two ways to keep going — an own installation, or
// taking the demo along as an export.
export function DemoBanner() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { locale } = useLocale()
  const { currentOrg } = useOrg()
  const demo = currentOrg?.demo
  if (!demo) return null

  const at = new Date(demo.expiresAt)
  const sameDay = at.toDateString() === new Date().toDateString()
  const when = at.toLocaleString(INTL_LOCALES[locale], sameDay ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm" data-testid="demo-banner">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        <div>
          <p className="font-medium">{m.demoTitle(when)}</p>
          <p className="text-muted-foreground">{m.demoHint}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/data">{m.demoTakeAlong}</Link>
        </Button>
        {demo.installUrl && (
          <Button size="sm" asChild>
            <a href={demo.installUrl}>{m.demoOwnInstall}</a>
          </Button>
        )}
      </div>
    </div>
  )
}
