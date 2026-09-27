import type { PaymentMethod } from '../lib'

// The kassa's texts — the source of truth; fr.ts and en.ts must match this
// shape (see src/shared/i18n). The kassa's language is the device's
// (Instellingen → Taal), fixed for as long as the page is open.
const nl = {
  // Header
  kassa: 'Kassa',
  eventHint: 'Verkopen worden aan dit evenement gekoppeld (Instellingen → Evenement)',
  catalogNamed: (name: string) => `Menukaart ${name}`,
  openDisplay: 'Klantscherm openen',
  settings: 'Instellingen',
  logout: 'Uitloggen',
  close: 'Sluiten',

  // Tab strip and ticket header. A Toog tab is stored as "Toog" whatever
  // the language (the customer display recognises it); `quickSale` is only
  // how it's shown.
  quickSale: 'Toog',
  payDirectly: 'Direct afrekenen',
  quickTitle: 'Toog — direct afrekenen',
  quickSubtitle: 'Nieuwe rekening bij afrekenen',
  openTab: 'Open rekening',
  tabNumber: (n: number) => `Rekening #${n}`,
  paymentRunning: 'Betaling loopt…',
  splitPaid: (paid: number, parts: number) => `${paid}/${parts} betaald`,
  newTab: '+ Nieuwe rekening',
  loading: 'Laden…',
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),

  // Ticket
  rename: 'Naam wijzigen',
  splitBanner: (parts: number, index: number) => `Gesplitst in ${parts} · deel ${index} van ${parts}`,
  stopSplit: 'Splitsen stoppen',
  itemsBanner: 'Per item · tik aan wat deze persoon betaalt',
  allOpen: 'Alles wat open is',
  stop: 'Stoppen',
  paymentPending: 'Er loopt een betaling voor deze rekening. Wacht tot die afgerond of verlopen is.',
  refresh: 'Vernieuwen',
  nothingYet: 'Nog niets aangeslagen.',
  tapToStart: 'Tik een product om te starten.',
  tip: 'Fooi',
  voided: (n: number) => `${n} geannuleerd`,
  unitsPaid: (n: number) => `✓ ${n} betaald`,
  voidLine: 'Annuleren',
  draftOnTab: 'Nieuw — nog niet toegevoegd',
  draftQuick: 'Bestelling',
  clear: 'Leegmaken',
  less: (name: string) => `minder ${name}`,
  more: (name: string) => `meer ${name}`,
  picked: (name: string, selected: number, payable: number) => `${name}: ${selected} van ${payable} gekozen`,
  alreadyPaid: 'Al betaald',
  stillToPay: 'Nog te betalen',
  toPay: 'Te betalen',

  // Paying
  paymentMethod: 'Betaalmethode',
  methods: { bancontact: 'Bancontact', cash: 'Contant', sumup: 'SumUp' } satisfies Record<PaymentMethod, string>,
  roundUp: 'Afronden',
  noTip: 'Geen fooi',
  pay: (amount: string | null) => (amount ? `Afrekenen ${amount}` : 'Afrekenen'),
  paySelection: (amount: string | null) => (amount ? `Afrekenen selectie · ${amount}` : 'Afrekenen selectie'),
  payPart: (index: number, of: number, amount: string) => `Afrekenen deel ${index}/${of} · ${amount}`,
  ofWhichTip: (amount: string) => `waarvan ${amount} fooi`,
  split: 'Splitsen',
  addOrder: 'Bestelling toevoegen aan rekening',
  park: 'Op rekening zetten',
  closeEmpty: 'Lege rekening sluiten',

  // Product picker
  catalogLoading: 'Menukaart laden…',
  noCatalog: 'Nog geen menukaart — een beheerder maakt er een in de console.',
  searchPlaceholder: 'Zoek product of typ een code…',
  searchLabel: 'Zoek product',
  group: 'Groep',
  all: 'Alles',
  noMatches: (query: string) => `Geen producten gevonden voor “${query}”.`,
  emptyGroup: 'Geen producten in deze groep.',
  entryHint: 'Klik: +1 · rechtsklik: −1',
  quickHint: (n: number) => `Klik: +${n} · rechtsklik: −${n}`,
  perPiece: (price: string) => `${price} per stuk · tik een aantal`,

  // Name and void dialogs
  newTabTitle: 'Nieuwe rekening',
  parkDescription: 'De bestelling komt op een nieuwe rekening die open blijft tot ze betaald wordt.',
  nameLabel: 'Naam of tafel',
  namePlaceholder: 'bv. Tafel 4, Jan',
  back: 'Terug',
  save: 'Opslaan',
  openTabButton: 'Rekening openen',
  voidTitle: 'Lijn annuleren',
  voidDescription: (n: number, name: string) => `${n} × ${name} — de lijn blijft zichtbaar in de geschiedenis, met reden.`,
  voidQuantity: 'Aantal annuleren',
  reason: 'Reden',
  // Stored with the void as typed, so in the kassa's language.
  quickReasons: ['Verkeerd aangeslagen', 'Klant annuleert', 'Niet leverbaar'],
  reasonPlaceholder: 'Of typ een reden',

  // Split dialog
  splitDescription: (amount: string) => `${amount} in meerdere betalingen. Elke betaling kiest haar eigen betaalmethode en fooi.`,
  splitHow: 'Hoe splitsen',
  splitEqual: 'Gelijk verdelen',
  splitItems: 'Per item',
  // Followed by the allOpen button's name, then splitItemsHelpEnd.
  splitItemsHelp: 'Tik op de rekening aan wat de eerste persoon betaalt, en reken af. Betaalde stuks blijven gemarkeerd; kies daarna voor de volgende persoon.',
  splitItemsHelpEnd: 'selecteert de rest.',
  people: 'Aantal personen',
  fewerPeople: 'Minder personen',
  morePeople: 'Meer personen',
  splitInto: (parts: number) => `In ${parts} verdelen`,
  pickItems: 'Items kiezen',

  // A payment in progress
  part: (index: number, of: number) => `Deel ${index} van ${of}`,
  qrAlt: 'QR-code voor betaling',
  status: 'Status:',
  expiresIn: (seconds: number) => `Vervalt over ${seconds}s`,
  expired: 'Verlopen',
  manual: {
    cash: { waiting: 'Wacht op contante betaling', confirm: 'Bevestig ontvangst contant geld', paid: 'Betaald (contant)' },
    sumup: { waiting: 'Wacht op SumUp betaling (automatisch, of bevestig hieronder)', confirm: 'Bevestig SumUp betaling', paid: 'Betaald (SumUp)' },
  } satisfies Record<'cash' | 'sumup', { waiting: string; confirm: string; paid: string }>,
  sumupFailed: (error: string) => `SumUp betaling mislukt: ${error}`,
  sumupFailedRetry: 'SumUp betaling mislukt. Probeer opnieuw of bevestig handmatig.',
  nextPart: 'Volgend deel',
  nextPerson: 'Volgende persoon',
  nextCustomer: 'Volgende klant',
  backToTab: 'Terug naar rekening',
  breakdownLine: (quantity: number, name: string, unitPrice: string, total: string) => `${quantity} × ${name} à ${unitPrice} = ${total}`,
  breakdownTip: (amount: string) => `Fooi = ${amount}`,

  // Notices and errors of the kassa's own (the server's come as they are)
  catalogGone: (name: string) => `De gekozen menukaart "${name}" is niet meer beschikbaar — de standaardmenukaart wordt gebruikt.`,
  linesDropped: (n: number) =>
    n === 1
      ? 'Andere menukaart geladen — 1 lijn die er niet op staat, is uit de bestelling gehaald.'
      : `Andere menukaart geladen — ${n} lijnen die er niet op staan, zijn uit de bestelling gehaald.`,
  catalogFailed: 'Kon de menukaart niet laden. Probeer opnieuw.',
  eventGone: (name: string) => `Het gekozen evenement "${name}" bestaat niet meer — verkopen worden niet meer aan een evenement gekoppeld.`,
  tabClosedElsewhere: 'Deze rekening is intussen afgesloten, mogelijk op een andere kassa.',
  orgUnknown: 'Organisatie van dit toestel nog niet bekend.',
  pickFirst: 'Kies eerst wat deze persoon betaalt.',
  nothingToPay: 'Niets te betalen op deze rekening.',
  unknownError: 'Onbekende fout',
  chargeFailed: 'Kon betaling niet registreren',
  waitForRegistration: 'Wacht tot dit toestel geregistreerd is voor u een klantscherm opent.',
  displayFailed: 'Kon klantscherm niet openen.',
}

export type KassaMessages = typeof nl
export default nl
