// The self-order pages' texts (a guest's phone) — the source of truth; fr.ts
// and en.ts must match this shape (see src/shared/i18n).
const nl = {
  loading: 'Laden…',
  closed: 'Bestellen kan hier nu niet. Bestel aan de toog.',
  notFound: 'Deze bestelling bestaat niet (meer).',
  steps: { menu: 'Menu', cart: 'Winkelmand', pay: 'Betalen', done: 'Bestelling' },
  add: (name: string) => `${name} toevoegen`,
  remove: (name: string) => `${name} één minder`,
  cartBar: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  toCart: 'Bekijk je bestelling',
  emptyCart: 'Je winkelmand is leeg.',
  backToMenu: 'Terug naar het menu',
  total: 'Totaal',
  next: 'Verder',
  payTitle: 'Betaal aan de toog',
  payHint: 'Plaats je bestelling, ga naar de toog en zeg je nummer. Daar betaal je, en dan wordt alles klaargemaakt.',
  payWithin: (minutes: number) => `Betaal binnen ${minutes} minuten, anders vervalt je bestelling.`,
  place: 'Bestelling plaatsen',
  placing: 'Bezig…',
  yourNumber: 'Je nummer',
  goPay: (number: number) => `Ga naar de toog en zeg: nummer ${number}.`,
  preparing: 'Je bestelling wordt klaargemaakt.',
  ready: 'Klaar!',
  readyHint: (places: string) => `Haal je bestelling op bij: ${places}.`,
  delivered: 'Alles afgehaald. Smakelijk!',
  nothingToPrepare: 'Betaald — er hoeft niets klaargemaakt te worden.',
  cancelled: 'Niet betaald op tijd: deze bestelling is vervallen.',
  newOrder: 'Nieuwe bestelling',
  keepOpen: 'Laat deze pagina open: je krijgt hier een seintje zodra je bestelling klaar is.',
  stationStatus: { ordered: 'Besteld', in_progress: 'In bereiding', ready: 'Klaar', delivered: 'Afgehaald' } as Record<string, string>,
  yourOrder: 'Je bestelling',
  live: 'Live',
  offline: 'Even geen verbinding — opnieuw verbinden…',
  soundOn: 'Geluid aan bij klaar',
}

export type SelfOrderMessages = typeof nl
export default nl
