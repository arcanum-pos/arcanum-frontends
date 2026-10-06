import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMessages } from '@/shared/i18n'
import { DEVICE_MESSAGES } from './messages'

// Signing in on this device with a phone (the OAuth device grant, against
// the instance's identity provider, through arcanum-bff's /device/start and
// /device/poll): a QR code and a short code; someone signs in on their
// phone, this device follows. Shown on the sign-in prompt (any page opened
// signed out) and at /device.
//
// The code is made here, by the page's script — never by the server for
// every visit: bots that hit the sign-in prompt don't run it, so they don't
// use up the identity provider's device codes (rate-limited per
// installation). A code renews itself shortly before it expires (10
// minutes), so a device left on this page always shows a working one.
const DEVICE_START_URL = '/device/start'
const RENEW_EARLY_SECONDS = 15

interface StartResult {
  userCode: string
  verificationUriComplete: string
  pollId: string
  interval: number
  expiresIn?: number
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

export function DeviceLogin({ onSignedIn, size = 200 }: { onSignedIn: () => void; size?: number }) {
  const m = useMessages(DEVICE_MESSAGES)
  const [state, setState] = useState<State>({ phase: 'starting' })
  // A new code: after a failure (the button), or when the last one is about to expire.
  const [attempt, setAttempt] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const signedIn = useRef(onSignedIn)
  useEffect(() => {
    signedIn.current = onSignedIn
  }, [onSignedIn])

  useEffect(() => {
    let cancelled = false
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

    function schedulePoll(pollId: string, intervalSeconds: number, userCode: string, verificationUriComplete: string) {
      later(async () => {
        if (cancelled) return
        try {
          const res = await fetch(`/device/poll?id=${encodeURIComponent(pollId)}`)
          const data = (await res.json()) as PollResult
          if (cancelled) return
          if (data.status === 'complete') {
            setState({ phase: 'complete', userCode, verificationUriComplete })
            signedIn.current()
            return
          }
          if (data.status === 'error') {
            // Expired between two renewals (e.g. the device slept): just a new code.
            if (data.message === 'expired_token' || data.message === 'Onbekende of verlopen aanvraag') {
              setAttempt((n) => n + 1)
              return
            }
            // A bare OAuth code (access_denied…) means nothing to a person: our own text then.
            setState({ phase: 'error', message: data.message && !/^[a-z_]+$/.test(data.message) ? data.message : null, failed: 'login' })
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
        const lifetime = Math.max(30, (data.expiresIn || 600) - RENEW_EARLY_SECONDS)
        later(() => !cancelled && setAttempt((n) => n + 1), lifetime * 1000)
      } catch {
        if (!cancelled) setState({ phase: 'error', message: null, failed: 'start' })
      }
    }

    start()
    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [attempt])

  return (
    <div className="flex flex-col items-center gap-4" data-testid="device-login">
      {state.phase === 'starting' && <Skeleton style={{ width: size, height: size }} />}
      {(state.phase === 'waiting' || state.phase === 'complete') && (
        <>
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={state.verificationUriComplete} size={size} marginSize={0} />
          </div>
          <p className="font-heading text-3xl font-extrabold tracking-widest" data-testid="user-code">
            {state.userCode}
          </p>
        </>
      )}
      <p
        className={
          state.phase === 'error'
            ? 'text-center text-sm font-semibold text-destructive'
            : state.phase === 'complete'
              ? 'text-center text-sm font-semibold text-green-600 dark:text-green-500'
              : 'text-center text-sm font-semibold text-muted-foreground'
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
    </div>
  )
}
