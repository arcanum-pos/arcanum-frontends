// Tap to Pay through the SumUp app ("Payment Switch", developer.sumup.com):
// the link that opens the SumUp Business app with the amount, and our charge
// id as the payment's foreign id. The app takes the card, then opens
// `returnUrl` with smp-status (and more) added. The backend never believes
// that status by itself: it looks the transaction up at SumUp.
// iOS and Android name the parameters differently (sumup-ios-url-scheme,
// sumup-android-api); Android also wants the app id the key was made for.

export interface SumupAppLink {
  affiliateKey: string
  appId: string
  amountCents: number
  title: string
  chargeId: string
  returnUrl: string
}

export function isAndroid(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Android/i.test(userAgent)
}

export function sumupAppLink(p: SumupAppLink, android = isAndroid()): string {
  const amount = (p.amountCents / 100).toFixed(2)
  const q = new URLSearchParams()
  if (android) {
    // `total` from SumUp app 1.88; older ones read `amount`.
    q.set('total', amount)
    q.set('amount', amount)
    q.set('currency', 'EUR')
    q.set('affiliate-key', p.affiliateKey)
    q.set('app-id', p.appId)
    q.set('title', p.title)
    q.set('foreign-tx-id', p.chargeId)
    q.set('skip-screen-success', 'true')
    q.set('callback', p.returnUrl)
  } else {
    q.set('amount', amount)
    q.set('currency', 'EUR')
    q.set('affiliate-key', p.affiliateKey)
    q.set('title', p.title)
    q.set('foreign-tx-id', p.chargeId)
    q.set('skip-screen-success', 'true')
    q.set('callbacksuccess', p.returnUrl)
    q.set('callbackfail', p.returnUrl)
  }
  return `sumupmerchant://pay/1.0?${q.toString()}`
}

// Back on our page: the charge, the table and what the app said (or null:
// not a return from the SumUp app).
export function sumupAppReturn(search: string): { chargeId: string; tableId: string | null; status: string } | null {
  const q = new URLSearchParams(search)
  const chargeId = q.get('sumup-charge')
  if (!chargeId) return null
  return { chargeId, tableId: q.get('table'), status: q.get('smp-status') ?? '' }
}
