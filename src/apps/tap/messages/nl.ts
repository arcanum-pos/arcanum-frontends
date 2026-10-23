// The Tap to Pay phone's texts — the source of truth; fr.ts and en.ts must
// match this shape (see src/shared/i18n).
const nl = {
  title: 'Tap to Pay',
  loading: 'Laden…',
  notThisPhone: 'Deze telefoon kan de betalingen van zijn kassa niet zien.',
  cantLoad: 'Laden lukte niet.',
  pairAgain: 'Opnieuw koppelen',
  // Not paired yet
  pairTitle: 'Deze telefoon koppelen',
  pairHint: 'Maak in de console bij Toestellen een koppelcode voor een Tap to Pay-telefoon (kies de kassa), en typ ze hier.',
  pairCode: 'Koppelcode',
  pair: 'Koppelen',
  wrongRole: 'Deze code is voor een ander soort toestel. Maak een code voor een Tap to Pay-telefoon.',
  iosFirstTitle: 'Eerst op je beginscherm',
  iosFirst: ['Tik onderaan op Deel (het vierkantje met het pijltje).', 'Kies "Zet op beginscherm" en tik op Voeg toe.', 'Open "Tap to Pay" vanaf je beginscherm en koppel daar.'],
  iosFirstWhy: 'Een iPhone toont meldingen alleen voor een pagina op het beginscherm - en die onthoudt de koppeling apart van Safari.',
  // Paired
  forKassa: (name: string) => `Voor ${name}`,
  noKassa: 'Niet gekoppeld aan een kassa - koppel opnieuw met een nieuwe code.',
  waiting: 'Wacht op een betaling aan de kassa.',
  waitingHint: 'Kies aan de kassa "Tap to Pay": de betaling verschijnt hier.',
  // A payment
  toPay: 'Te betalen',
  payButton: 'Betaal met Tap to Pay',
  payHint: 'Opent de SumUp-app. De klant houdt de kaart of gsm tegen deze telefoon.',
  checking: 'Even nakijken bij SumUp…',
  paid: 'Betaald',
  paidHint: 'De kassa ziet het ook.',
  failed: 'Niet betaald',
  failedHint: 'Probeer opnieuw, of kies aan de kassa een andere manier.',
  tryAgain: 'Opnieuw proberen',
  gone: 'Deze betaling bestaat niet meer - ze werd afgerond of geannuleerd aan de kassa.',
  notSetUp: 'Tap to Pay is niet ingesteld: vul in de console bij Betaalproviders de affiliate key van SumUp in.',
  done: 'Klaar',
  // Notifications
  pushTitle: 'Melding bij een betaling',
  pushHint: 'Krijg een melding zodra de kassa Tap to Pay kiest - ook als deze telefoon vergrendeld is.',
  pushOn: 'Meldingen aanzetten',
  pushSet: 'Meldingen staan aan.',
  pushOff: 'Uitzetten',
  pushDenied: 'Meldingen zijn geweigerd. Zet ze aan in de instellingen van je browser (niet in een privévenster).',
  pushFailed: 'Meldingen aanzetten lukte niet. Probeer opnieuw.',
}

export type TapMessages = typeof nl
export default nl
