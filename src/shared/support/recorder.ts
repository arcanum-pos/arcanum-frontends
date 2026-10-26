// What happened just before someone pressed ?: the last errors, failed API
// calls, navigations and clicks — kept in memory only, in small rings, and
// only ever sent when the user sends a report (and sees it first, in the
// form). Started once per page by the ? button (support-button.tsx).

export class Ring<T> {
  private items: T[] = []
  private readonly size: number
  constructor(size: number) {
    this.size = size
  }
  push(item: T) {
    this.items.push(item)
    if (this.items.length > this.size) this.items.shift()
  }
  list(): T[] {
    return [...this.items]
  }
}

// Seconds since the page loaded: enough to order things, no clock time.
const at = () => Math.round(performance.now() / 100) / 10

export const clip = (text: string, max = 40) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

// A path without its query or fragment: a query can hold codes and tokens.
export function pathOnly(url: string, base = 'http://x'): string {
  try {
    const u = new URL(url, base)
    return u.origin === new URL(base).origin ? u.pathname : `${u.origin}${u.pathname}`
  } catch {
    return ''
  }
}

// "button: Pay", "a: Settings", "input[search]".
export function describeTarget(el: { tagName: string; type?: string; label?: string | null; text?: string | null }): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return `${tag}${el.type ? `[${el.type}]` : ''}${el.label ? `: ${clip(el.label)}` : ''}`
  const name = el.label || el.text || ''
  return name ? `${tag}: ${clip(name)}` : tag
}

export interface Recorded {
  errors: { at: number; message: string }[]
  failedRequests: { at: number; method: string; path: string; status: number | 'network'; ms: number }[]
  navigations: { at: number; path: string }[]
  clicks: { at: number; target: string }[]
}

const errors = new Ring<Recorded['errors'][number]>(20)
const failedRequests = new Ring<Recorded['failedRequests'][number]>(20)
const navigations = new Ring<Recorded['navigations'][number]>(10)
const clicks = new Ring<Recorded['clicks'][number]>(10)

export function recorded(): Recorded {
  return { errors: errors.list(), failedRequests: failedRequests.list(), navigations: navigations.list(), clicks: clicks.list() }
}

const errorText = (value: unknown) => clip(value instanceof Error ? `${value.name}: ${value.message}` : String(value), 300)

let started = false

export function startRecording(ignoreOrigin: string) {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('error', (e) => errors.push({ at: at(), message: errorText(e.error ?? e.message) }))
  window.addEventListener('unhandledrejection', (e) => errors.push({ at: at(), message: errorText(e.reason) }))
  const consoleError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    errors.push({ at: at(), message: clip(args.map((a) => (a instanceof Error ? errorText(a) : typeof a === 'string' ? a : safeJson(a))).join(' '), 300) })
    consoleError(...args)
  }

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const note = (status: number | 'network') => {
      if (url.startsWith(ignoreOrigin)) return
      failedRequests.push({ at: at(), method, path: pathOnly(url, location.origin), status, ms: Math.round(performance.now() - started) })
    }
    try {
      const res = await realFetch(input, init)
      if (!res.ok) note(res.status)
      return res
    } catch (err) {
      note('network')
      throw err
    }
  }

  const navigated = () => navigations.push({ at: at(), path: location.pathname + location.hash.split('?')[0] })
  for (const name of ['pushState', 'replaceState'] as const) {
    const real = history[name].bind(history)
    history[name] = (...args: Parameters<History['pushState']>) => {
      real(...args)
      navigated()
    }
  }
  window.addEventListener('popstate', navigated)
  window.addEventListener('hashchange', navigated)
  navigated()

  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, a, [role="button"], [role="tab"], [role="menuitem"], input, select, textarea, label')
      if (!el || el.closest('[data-support-ignore]')) return
      clicks.push({
        at: at(),
        target: describeTarget({
          tagName: el.tagName,
          type: el instanceof HTMLInputElement ? el.type : undefined,
          label: el.getAttribute('aria-label') ?? (el instanceof HTMLInputElement ? el.placeholder || el.name : null),
          // Never what someone typed: only a control's own text.
          text: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? null : el.textContent,
        }),
      })
    },
    { capture: true },
  )
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
