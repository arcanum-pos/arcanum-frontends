import type { Role } from '@/shared/terminal'

// The start page's texts (root `/`) — the source of truth; fr.ts and en.ts
// must match this shape (see src/shared/i18n).
const nl = {
  title: 'Wat wil je doen?',
  pairTitle: 'Dit toestel koppelen',
  pairHint: 'Als kassa of klantscherm, met een koppelcode. Een beheerder maakt die in de console bij Toestellen → Toestel toevoegen.',
  code: 'Koppelcode',
  pair: 'Koppelen',
  busy: 'Bezig…',
  manageTitle: 'Beheer',
  manageHint: 'De console: menukaarten, toestellen, gebruikers en rapporten.',
  manage: 'Naar de console',
  removed: 'Dit toestel is niet meer gekoppeld (het werd verwijderd in de console). Koppel het opnieuw met een nieuwe code.',
  pairedTitle: (name: string) => `Dit toestel is ${name}`,
  org: (name: string) => `Organisatie: ${name}`,
  open: 'Openen',
  replaceHint: 'Je opende een koppelcode. Koppel je deze browser ermee, dan is hij dit toestel niet meer en moet je het later opnieuw koppelen.',
  replaceYes: 'Koppelen met de nieuwe code',
  replaceNo: (name: string) => `Nee, open ${name}`,
  roles: { pos: 'een kassa', cfd: 'een klantscherm' } satisfies Record<Role, string>,
}

export type ChooserMessages = typeof nl
export default nl
