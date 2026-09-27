// The customer display's texts — the source of truth; fr.ts and en.ts must
// match this shape (see src/shared/i18n).
const nl = {
  idle: 'Klaar voor de volgende bestelling',
  fullscreen: 'Volledig scherm',
  language: 'Taal',
  loadingStatus: 'status laden...',
  linkedTo: (posId: string) => `gekoppeld aan kassa ${posId}`,
  notLinked: 'niet gekoppeld aan een kassa',

  yourOrder: 'Jouw bestelling',
  yourShare: 'Jouw deel',
  alreadyPaid: 'Al betaald',
  tip: 'Fooi',
  totalDue: 'Totaal te betalen',
  partDue: (index: number, of: number) => `Te betalen · deel ${index} van ${of}`,
  stillOpen: (amount: string) => `Nog open op de rekening: ${amount}`,
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  qrAlt: 'QR-code voor betaling',
  waiting: 'Wachten op je betaling',
  // `status` is a STATUS_MESSAGES label, e.g. "Mislukt".
  failed: (status: string) => `Betaling ${status.toLowerCase()} — vraag het aan de toog`,
  failedFallback: 'Mislukt',
  expiresIn: (seconds: number) => `Vervalt over ${seconds}s`,
  expired: 'Verlopen',

  methods: { bancontact: 'Bancontact', cash: 'Contant', sumup: 'SumUp' } as Record<string, string>,
  payWith: {
    cash: 'Gelieve contant te betalen',
    sumup: 'Gelieve te betalen via SumUp',
    bancontact: 'Gelieve te betalen via Bancontact',
  } as Record<string, string>,
  // What the customer is told while the payment runs, per method.
  instructions: {
    bancontact: 'Open je bankapp, scan de code en bevestig. Het scherm springt automatisch verder.',
    cash: 'Betaal aan de toog — het scherm springt verder zodra de ontvangst bevestigd is.',
    sumup: 'Betaal met je kaart of gsm op de betaalterminal.',
  } as Record<string, string>,

  thanks: 'Bedankt!',
  paid: (amount: string, method: string) => `${amount} betaald · ${method}`,
  part: (index: number, of: number) => `Deel ${index} van ${of}`,
}

export type DisplayMessages = typeof nl
export default nl
