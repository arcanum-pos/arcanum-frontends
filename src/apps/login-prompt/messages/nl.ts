// The login prompt's texts — the source of truth; fr.ts and en.ts must match
// this shape (see src/shared/i18n).
const nl = {
  title: 'Aanmelden vereist',
  description: 'Je moet aangemeld zijn om deze pagina te bekijken.',
  signIn: 'Aanmelden om verder te gaan',
}

export type LoginPromptMessages = typeof nl
export default nl
