// Instellingen's texts — the source of truth; fr.ts and en.ts must match
// this shape (see src/shared/i18n).
const nl = {
  title: 'Instellingen',
  back: '← Terug',
  thisDevice: 'Dit toestel',
  deviceNamePlaceholder: 'bv. Kassa 1',
  saveName: 'Naam opslaan',
  nameSaved: 'Naam van dit toestel opgeslagen.',
  deviceId: (id: string) => `Toestel-ID: ${id}`,
  language: 'Taal',
  languageHint: 'De taal van de kassa en het klantscherm op dit toestel. Klanten kunnen op het klantscherm zelf nog een andere kiezen.',
  appearance: 'Weergave',
  appearanceHint: 'Licht of donker, voor de kassa en het klantscherm op dit toestel. Systeem volgt de instelling van het toestel zelf.',
  catalog: 'Menukaart',
  catalogHint: 'Welke menukaart deze kassa verkoopt.',
  event: 'Evenement',
  eventHint: 'Optioneel: aan welk evenement de verkopen van deze kassa gekoppeld worden (voor de rapporten).',
  linkDisplay: 'Klantscherm koppelen',
  reader: 'SumUp Solo-reader',
  readerHint: 'Echte reader gekoppeld aan je SumUp-account. Betalingen gaan dan via de SumUp cloud-API (polling, nog geen callback).',
  freeSoftware: 'Arcanum is vrije software (AGPL-3.0)',
  sourceCode: 'Broncode',

  choose: 'Kies',
  active: 'Actief',
  chooseNamed: (name: string) => `Kies ${name}`,
  activeNamed: (name: string) => `${name} actief`,
  activeIs: (name: string) => `Actief: ${name}`,
  refresh: 'Vernieuwen',

  catalogsLoading: 'Menukaarten laden...',
  catalogsNone: 'Nog geen menukaart — een beheerder maakt er een in de console.',
  catalogsFailed: 'Kon menukaarten niet ophalen.',
  catalogOrgDefaultActive: 'Actief: standaardmenukaart van de organisatie.',
  catalogOrgDefault: (name: string | null) => `Standaard van de organisatie${name ? ` (${name})` : ''}`,

  eventsLoading: 'Evenementen laden...',
  eventsNone: 'Nog geen evenementen — een beheerder maakt ze aan in de console (Evenementen).',
  eventsFailed: 'Kon evenementen niet ophalen.',
  eventNoneActive: 'Geen evenement — verkopen worden niet aan een evenement gekoppeld.',
  noEvent: 'Geen evenement',
  chooseNoEvent: 'Kies geen evenement',
  noEventActive: 'Geen evenement actief',

  readersLoading: 'Readers laden...',
  readersNotConfigured: 'SumUp cloud-API niet geconfigureerd voor deze organisatie (zie organisatie-instellingen).',
  readersFailed: 'Kon readers niet ophalen.',
  readersFailedWith: (error: string) => `Kon readers niet ophalen: ${error}`,
  readerNoneSelected: 'Geen reader geselecteerd — je bevestigt SumUp-betalingen zelf op de kassa.',
  noReader: 'Geen reader (zelf bevestigen)',

  linkedLoading: 'Gekoppeld: laden...',
  linked: (id: string) => `Gekoppeld: ${id}`,
  nothingLinked: 'Niets gekoppeld.',
  unlink: 'Ontkoppelen',
  link: 'Koppel',

  slot: (n: number, startedAt: string) => `Tijdvak ${n} (${startedAt})`,
  activeSlot: (slot: string) => `Actief tijdvak: ${slot}`,
  confirmNewSlot: 'Nieuw tijdvak starten? Bestaande transacties blijven bewaard onder het huidige tijdvak.',
  newSlotStarted: 'Nieuw tijdvak gestart.',
  startNewSlot: 'Nieuw tijdvak starten',
}

export type SettingsMessages = typeof nl
export default nl
