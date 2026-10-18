// Web Push (release G', ROADMAP §8b): on the follow page, a notification
// when a station's part is ready; on a kassa's Tap to Pay phone, a payment
// to take — even with the phone locked. Android and desktop browsers can do
// it right here; an iPhone only from a page added to its home screen (then
// opened from there) — so it gets those steps instead. `scope`: the pages
// the service worker (/push-sw.js) is for — '/volg/' or '/tap'.

export type PushSupport = 'yes' | 'ios-home-screen' | 'no'

export function isIos(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // An iPad says it's a Mac; it has a touch screen though.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
}

export function isStandalone(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function pushSupport(): PushSupport {
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos() && !isStandalone()) return 'ios-home-screen'
  return capable ? 'yes' : 'no'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const s = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4))
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// Permission asked (needs the guest's tap), then this browser's
// subscription, to hand to the backend. 'denied': the guest (or the
// browser) said no.
// The permission is asked first, before anything is awaited: Safari only
// shows its question straight from the tap — after an await it refuses
// without asking (and the site lands on its "Deny" list).
export async function subscribePush(publicKey: string, scope = '/volg/'): Promise<PushSubscriptionJSON | 'denied'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const registration = await navigator.serviceWorker.register('/push-sw.js', { scope })
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  return subscription.toJSON()
}

// This browser's subscription, when it has one already and may still notify
// (allowed for an earlier order): the next order needs no tap. Never asks.
export async function existingPush(scope = '/volg/'): Promise<PushSubscriptionJSON | null> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null
  const registration = await navigator.serviceWorker?.getRegistration(scope)
  return (await registration?.pushManager.getSubscription())?.toJSON() ?? null
}

export async function unsubscribePush(scope = '/volg/'): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration(scope)
  await (await registration?.pushManager.getSubscription())?.unsubscribe()
}

// On an iPhone the home-screen icon must open this very order (it doesn't
// share Safari's storage): the order's own manifest (made by arcanum-bff),
// and the name under the icon.
// `orgId`: its icons are the organisation's own (arcanum-bff, `icon`).
export function linkOrderManifest(token: string, title: string, orgId?: string | null): () => void {
  const added: HTMLElement[] = []
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    document.head.appendChild(el)
    added.push(el)
  }
  add('link', { rel: 'manifest', href: `/volg/${encodeURIComponent(token)}/manifest.webmanifest${orgId ? `?${new URLSearchParams({ icon: `${orgId}/selforder` })}` : ''}` })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: title })
  return () => added.forEach((el) => el.remove())
}
