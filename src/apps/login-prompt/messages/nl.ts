// The login prompt's texts — the source of truth; fr.ts and en.ts must match
// this shape (see src/shared/i18n).
const nl = {
  title: 'Aanmelden',
  description: 'Je moet aangemeld zijn om verder te gaan. Kies hoe.',
  hereTitle: 'Op dit toestel',
  hereHint: 'Met je wachtwoord, Google of een passkey.',
  signIn: 'Aanmelden',
  phoneTitle: 'Met je telefoon',
  phoneHint: 'Scan de QR-code en meld je aan op je telefoon — dit toestel volgt vanzelf. Handig voor een kassa of klantscherm.',
}

export type LoginPromptMessages = typeof nl
export default nl
