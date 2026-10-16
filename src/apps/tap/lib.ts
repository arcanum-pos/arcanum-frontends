// The Tap to Pay phone's addresses: /tap?charge=…&t=… is one payment (the
// kassa's QR, or this page itself on its way to the SumUp app and back —
// then with SumUp's smp-status added).

export interface TapAddress {
  chargeId: string
  token: string
  // What the SumUp app said on its way back ('' when it didn't come back
  // from the app): never believed by itself — the backend asks SumUp.
  returned: string | null
}

export function readTapAddress(search: string): TapAddress | null {
  const q = new URLSearchParams(search)
  const chargeId = q.get('charge')
  const token = q.get('t')
  if (!chargeId || !token) return null
  return { chargeId, token, returned: q.get('smp-status') }
}

// Where the SumUp app comes back to: this payment's own address.
export function tapReturnUrl(origin: string, chargeId: string, token: string): string {
  return `${origin}/tap?charge=${encodeURIComponent(chargeId)}&t=${encodeURIComponent(token)}`
}
