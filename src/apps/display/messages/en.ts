import type { DisplayMessages } from './nl'

export default {
  idle: 'Ready for the next order',
  fullscreen: 'Full screen',
  loadingStatus: 'loading status...',
  linkedTo: (posId: string) => `linked to till ${posId}`,
  notLinked: 'not linked to a till',

  yourOrder: 'Your order',
  total: 'Total',
  checkOrder: 'Is your order right? Tell the cashier.',
  yourShare: 'Your share',
  alreadyPaid: 'Already paid',
  tip: 'Tip',
  totalDue: 'Total to pay',
  partDue: (index: number, of: number) => `To pay · part ${index} of ${of}`,
  stillOpen: (amount: string) => `Still open on the bill: ${amount}`,
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  qrAlt: 'QR code for payment',
  waiting: 'Waiting for your payment',
  failed: (status: string) => `Payment ${status.toLowerCase()} - please ask at the counter`,
  failedFallback: 'Failed',
  expiresIn: (seconds: number) => `Expires in ${seconds}s`,
  expired: 'Expired',

  methods: { bancontact: 'Bancontact', cash: 'Cash', sumup: 'SumUp', tap: 'Tap to Pay' },
  payWith: {
    cash: 'Please pay in cash',
    sumup: 'Please pay via SumUp',
    tap: 'Please pay via Tap to Pay',
    bancontact: 'Please pay via Bancontact',
  },
  instructions: {
    bancontact: 'Open your banking app, scan the code and confirm. The screen moves on automatically.',
    cash: 'Pay at the counter - the screen moves on once the payment is confirmed.',
    sumup: 'Pay with your card or phone on the payment terminal.',
    tap: "Hold your card or phone against the cashier's phone.",
  },

  // Above the amount once it's paid.
  paidLabel: 'Paid',
  // Items whose product has no category, beside those that have one.
  otherCategory: 'Other',
  thanks: 'Thank you!',
  yourNumber: (n: number) => `Your number: ${n}`,
  followHint: 'Scan to see when your order is ready.',
  followQrAlt: 'QR code to follow your order',
  paid: (amount: string, method: string) => `${amount} paid · ${method}`,
  part: (index: number, of: number) => `Part ${index} of ${of}`,
} satisfies DisplayMessages
