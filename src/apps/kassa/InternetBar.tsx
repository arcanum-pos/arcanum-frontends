import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useMessages } from '@/shared/i18n'
import { KASSA_MESSAGES } from './messages'

const EVERY_MS = 60_000

// On a local installation with a backup in the cloud (OFFLINE.md), the box
// knows whether it reaches the internet (its sync does or not). Without it,
// selling goes on, but card payments, Tap to Pay and Payconiq don't work.
// Without a backup there's nothing to ask: one call, then quiet.
export function InternetBar({ orgId }: { orgId: string }) {
  const m = useMessages(KASSA_MESSAGES)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      try {
        const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/backup/connection`)
        const body = res.ok ? ((await res.json()) as { linked: boolean; online: boolean | null }) : null
        if (cancelled) return
        setOffline(body?.online === false)
        if (body?.linked) timer = setTimeout(check, EVERY_MS)
      } catch {
        // The box itself out of reach: the kassa's own errors say so.
      }
    }
    void check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [orgId])

  if (!offline) return null
  return (
    <div role="status" data-testid="internet-bar" className="flex items-center justify-center gap-1.5 border-b border-amber-500/50 bg-amber-500/15 px-5 py-1.5 text-[13px]">
      <WifiOff className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      {m.noInternet}
    </div>
  )
}
