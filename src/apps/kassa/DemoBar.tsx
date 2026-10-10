import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { KASSA_MESSAGES } from './messages'

// A demo org (is_locked = 'N') disappears by itself (arcanum-cleaner). A demo
// starts on this kassa (the bootstrapper pairs the browser), so say when it
// goes, and lead to the console — the rest of Arcanum. Nothing for a real org.
export function DemoBar({ orgId }: { orgId: string }) {
  const m = useMessages(KASSA_MESSAGES)
  const { locale } = useLocale()
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/organizations')
      .then((res) => (res.ok ? res.json() : []))
      .then((orgs: { id: string; demo?: { expiresAt: string } | null }[]) => {
        const demo = Array.isArray(orgs) ? orgs.find((o) => o.id === orgId)?.demo : null
        if (!cancelled && demo?.expiresAt) setExpiresAt(demo.expiresAt)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orgId])

  if (!expiresAt) return null
  const at = new Date(expiresAt)
  const sameDay = at.toDateString() === new Date().toDateString()
  const when = at.toLocaleString(INTL_LOCALES[locale], sameDay ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-sky-500/40 bg-sky-500/10 px-5 py-1.5 text-[13px]" data-testid="demo-bar">
      <span className="flex items-center gap-1.5">
        <Clock className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        {m.demoBar(when)}
      </span>
      <a href="/console" target="_blank" rel="noopener" className="font-medium underline underline-offset-2">
        {m.demoConsole}
      </a>
    </div>
  )
}
