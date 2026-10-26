import { pickVersionInfo } from '@/shared/source-url'
import { getStoredTerminalInfo } from '@/shared/terminal'
import { recorded, type Recorded } from './recorder'

// Everything the ? button sends along with a report — shown in the form
// before Send (SUPPORT.md, 7). Nothing hidden: no e-mail (that's the form's
// own, visible field), no query strings, nothing typed into a field.

declare const __ARCANUM_COMMIT__: string | undefined

export interface SupportMetadata extends Recorded {
  screen: string
  release: string | null
  commit: string | null
  page: string
  title: string
  locale: string
  theme: 'light' | 'dark'
  organization: { id: string; name?: string } | null
  device: { role: string; name?: string } | null
  browser: Record<string, unknown>
}

interface UserAgentData {
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}

async function browserDetails(): Promise<Record<string, unknown>> {
  const nav = navigator as Navigator & { userAgentData?: UserAgentData; deviceMemory?: number; connection?: { effectiveType?: string } }
  const details: Record<string, unknown> = {
    userAgent: navigator.userAgent,
    languages: [...(navigator.languages ?? [])],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`,
    devicePixelRatio,
    touchPoints: navigator.maxTouchPoints,
    online: navigator.onLine,
    standalone: matchMedia('(display-mode: standalone)').matches,
    prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    cores: navigator.hardwareConcurrency,
  }
  if (nav.deviceMemory) details.memoryGB = nav.deviceMemory
  if (nav.connection?.effectiveType) details.connection = nav.connection.effectiveType
  const nav0 = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (nav0) details.loadMs = Math.round(nav0.loadEventEnd || nav0.domContentLoadedEventEnd)
  try {
    const high = await nav.userAgentData?.getHighEntropyValues?.(['platformVersion', 'model', 'fullVersionList'])
    if (high) details.client = { platform: high.platform, platformVersion: high.platformVersion, model: high.model || undefined, brands: high.fullVersionList }
  } catch {
    // Not offered: the user agent will do.
  }
  return details
}

async function release(): Promise<string | null> {
  try {
    const res = await fetch('/version', { signal: AbortSignal.timeout(2000) })
    return res.ok ? (pickVersionInfo(await res.json()).release ?? null) : null
  } catch {
    return null
  }
}

// The console keeps its own current organization; a device has its pairing.
function organization(device: ReturnType<typeof getStoredTerminalInfo>): SupportMetadata['organization'] {
  try {
    const admin = localStorage.getItem('arcanum-admin-current-org')
    if (location.pathname.startsWith('/console') && admin) return { id: admin }
  } catch {
    // no storage
  }
  return device ? { id: device.orgId, name: device.orgName } : null
}

export async function collectMetadata(screen: string, locale: string): Promise<SupportMetadata> {
  const device = getStoredTerminalInfo()
  return {
    screen,
    release: await release(),
    commit: typeof __ARCANUM_COMMIT__ === 'string' && __ARCANUM_COMMIT__ ? __ARCANUM_COMMIT__ : null,
    page: location.pathname + location.hash.split('?')[0],
    title: document.title,
    locale,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    organization: organization(device),
    device: device ? { role: device.role, name: device.name } : null,
    browser: await browserDetails(),
    ...recorded(),
  }
}

// The signed-in person's address, to prefill the form's (visible, optional)
// reply field. A device without a person signed in: none.
export async function signedInEmail(): Promise<string | undefined> {
  try {
    const res = await fetch('/whoami', { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return undefined
    const me = (await res.json()) as { email?: unknown }
    return typeof me.email === 'string' ? me.email : undefined
  } catch {
    return undefined
  }
}
