import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMessages } from '@/shared/i18n'
import { KioskShell } from '@/shared/kiosk-shell'
import { DEVICE_MESSAGES } from './messages'

// Served at either /device (platform default) or /<orgId>/device (that
// org's own identity provider) — derive the matching /device/start URL from
// wherever this page itself was loaded from, so an org-scoped page actually
// starts an org-scoped login rather than always falling back to the
// default. /device/poll deliberately stays a single global path: the org is
// carried in the pollId's own stored session server-side, so it needs no
// prefix.
const DEVICE_START_URL = window.location.pathname.replace(/\/device$/, '') + '/device/start'

interface StartResult {
  userCode: string
  verificationUriComplete: string
  pollId: string
  interval: number
  error?: string
}

interface PollResult {
  status: 'pending' | 'complete' | 'error'
  interval?: number
  message?: string
}

type State =
  | { phase: 'starting' }
  | { phase: 'waiting'; userCode: string; verificationUriComplete: string }
  | { phase: 'complete'; userCode: string; verificationUriComplete: string }
  // `message` is the server's own; without one, `failed` picks our text.
  | { phase: 'error'; message: string | null; failed: 'login' | 'start' }

export default function App() {
  const m = useMessages(DEVICE_MESSAGES)
  const [state, setState] = useState<State>({ phase: 'starting' })
  const [attempt, setAttempt] = useState(0)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    function stopPolling() {
      if (pollTimer.current) clearTimeout(pollTimer.current)
      pollTimer.current = null
    }

    async function schedulePoll(pollId: string, intervalSeconds: number, userCode: string, verificationUriComplete: string) {
      pollTimer.current = setTimeout(async () => {
        if (cancelled) return
        try {
          const res = await fetch(`/device/poll?id=${encodeURIComponent(pollId)}`)
          const data = (await res.json()) as PollResult
          if (cancelled) return

          if (data.status === 'complete') {
            setState({ phase: 'complete', userCode, verificationUriComplete })
            window.location.href = '/'
            return
          }

          if (data.status === 'error') {
            setState({ phase: 'error', message: data.message || null, failed: 'login' })
            return
          }

          schedulePoll(pollId, data.interval || intervalSeconds, userCode, verificationUriComplete)
        } catch {
          if (!cancelled) schedulePoll(pollId, intervalSeconds, userCode, verificationUriComplete)
        }
      }, intervalSeconds * 1000)
    }

    async function start() {
      setState({ phase: 'starting' })
      try {
        const res = await fetch(DEVICE_START_URL, { method: 'POST' })
        const data = (await res.json()) as StartResult
        if (cancelled) return

        if (!res.ok || data.error) {
          setState({ phase: 'error', message: data.error || null, failed: 'start' })
          return
        }

        setState({ phase: 'waiting', userCode: data.userCode, verificationUriComplete: data.verificationUriComplete })
        schedulePoll(data.pollId, data.interval, data.userCode, data.verificationUriComplete)
      } catch {
        if (!cancelled) setState({ phase: 'error', message: null, failed: 'start' })
      }
    }

    start()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [attempt])

  return (
    <KioskShell maxWidth="max-w-md" languagePicker>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">{m.title}</CardTitle>
          <CardDescription>{m.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {state.phase === 'starting' && <Skeleton className="size-[200px]" />}

          {(state.phase === 'waiting' || state.phase === 'complete') && (
            <>
              <QRCodeSVG value={state.verificationUriComplete} size={200} marginSize={1} />
              <p className="font-heading text-3xl font-extrabold tracking-widest">{state.userCode}</p>
            </>
          )}

          <p
            className={
              state.phase === 'error'
                ? 'text-sm font-semibold text-destructive'
                : state.phase === 'complete'
                  ? 'text-sm font-semibold text-green-600 dark:text-green-500'
                  : 'text-sm font-semibold text-muted-foreground'
            }
          >
            {state.phase === 'starting' && m.starting}
            {state.phase === 'waiting' && m.waiting}
            {state.phase === 'complete' && m.complete}
            {state.phase === 'error' && (state.message || (state.failed === 'login' ? m.loginFailed : m.startFailed))}
          </p>

          {state.phase === 'error' && (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {m.retry}
            </Button>
          )}
        </CardContent>
      </Card>
    </KioskShell>
  )
}
