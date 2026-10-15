// The waiter screen's texts — the source of truth; fr.ts and en.ts must
// match this shape (see src/shared/i18n).
const nl = {
  loading: 'Laden…',
  noAccess: 'Je hebt geen toegang tot de bediening. Vraag een beheerder je uit te nodigen (rol Bediening).',
  noEvent: 'Geen evenement met een bestelwijze "aan tafel". Een beheerder stelt dat in bij het evenement (Bestelwijzen).',
  chooseOrg: 'Welke organisatie?',
  chooseEvent: 'Welk evenement?',
  tables: 'Tafels',
  noTables: 'Nog geen tafels. Een beheerder maakt ze in de console (Tafels).',
  states: { free: 'Vrij', occupied: 'Bezet', clearing: 'Af te ruimen' } as Record<'free' | 'occupied' | 'clearing', string>,
  back: 'Terug',
  table: (name: string) => `Tafel ${name}`,
  seat: 'Gasten plaatsen',
  cleared: 'Opgeruimd',
  order: 'Bestellen',
  pay: 'Afrekenen',
  nothingYet: 'Nog niets besteld.',
  toPay: 'Te betalen',
  less: (name: string) => `Eén ${name} minder`,
  more: (name: string) => `Eén ${name} meer`,
  send: (total: string) => `Doorsturen · ${total}`,
  paid: 'Betaald',
  bancontact: 'Bancontact (QR op dit scherm)',
  scanBancontact: 'Laat de gast deze code scannen met de Bancontact-app.',
  sumup: (reader: string) => `SumUp · ${reader}`,
  onReader: (reader: string) => `Het bedrag staat op ${reader}. Laat de gast betalen.`,
  cashAtTill: (label: string) => `Contant? De gasten betalen aan de kassa: rekening "${label}".`,
}

export type WaiterMessages = typeof nl
export default nl
