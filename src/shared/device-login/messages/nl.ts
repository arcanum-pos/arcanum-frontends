// The device-login (QR) page's texts — the source of truth; fr.ts and en.ts
// must match this shape (see src/shared/i18n).
const nl = {
  title: 'Aanmelden op dit toestel',
  description: 'Scan de QR-code met je telefoon, of ga naar de getoonde link en voer de code in.',
  starting: 'Code aanmaken...',
  waiting: 'Wachten op bevestiging op je telefoon...',
  complete: 'Aangemeld! Doorsturen...',
  retry: 'Opnieuw proberen',
  // When the server gives no message of its own.
  loginFailed: 'Aanmelden mislukt.',
  startFailed: 'Kon apparaatcode niet aanmaken.',
}

export type DeviceMessages = typeof nl
export default nl
