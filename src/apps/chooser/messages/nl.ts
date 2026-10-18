import type { Role } from '@/shared/terminal'

// The start page's texts (root `/`) — the source of truth; fr.ts and en.ts
// must match this shape (see src/shared/i18n).
const nl = {
  title: 'Wat wil je doen?',
  pairTitle: 'Dit toestel koppelen',
  pairHint: 'Als kassa, klantscherm of stationscherm, met een koppelcode. Een beheerder maakt die in de console bij Toestellen → Toestel toevoegen.',
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
  signInTitle: 'Meld je aan om deze kassa te koppelen',
  signInHint: 'Een kassa werkt met de persoon die erop aangemeld is. Meld je aan; daarna wordt dit toestel meteen gekoppeld.',
  signIn: 'Aanmelden',
  replaceHint: 'Je opende een koppelcode. Koppel je deze browser ermee, dan is hij dit toestel niet meer en moet je het later opnieuw koppelen.',
  replaceYes: 'Koppelen met de nieuwe code',
  replaceNo: (name: string) => `Nee, open ${name}`,
  installQuestion: 'Hoe wil je dit toestel gebruiken?',
  asApp: 'Als app (aanbevolen)',
  asAppHint: 'Met een eigen icoon, en het opent altijd meteen dit scherm.',
  inBrowser: 'In deze browser',
  iosSteps: (name: string) => ['Tik op Deel ⬆️ (onderaan, of bovenaan op een iPad).', `Kies Zet op beginscherm: de naam ${name} staat al ingevuld.`, `Open ${name} vanaf je beginscherm: daar wordt het gekoppeld.`],
  macSteps: (name: string) => ['Kies in de menubalk Archief → Voeg toe aan Dock.', `Kies Voeg toe: de naam ${name} staat al ingevuld.`, `Open ${name} vanuit het Dock: daar wordt het gekoppeld.`],
  codeValid: 'De koppelcode is 10 minuten geldig: doe het meteen.',
  inBrowserAfterAll: 'Toch in deze browser koppelen',
  appNames: { pos: 'Kassa', cfd: 'Klantscherm', station: 'Station', tap: 'Tap to Pay' } satisfies Record<Role, string>,
  roles: { pos: 'een kassa', cfd: 'een klantscherm', station: 'een stationscherm', tap: 'een Tap to Pay-telefoon' } satisfies Record<Role, string>,
}

export type ChooserMessages = typeof nl
export default nl
