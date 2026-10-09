import type { DeviceRole } from '../../lib/api'
import type { ExportTable } from '../../lib/org-transfer'
import type { Period } from '../../lib/reports'

// The admin console's "org" texts (Rapporten, Events, Devices, Users, the
// org import) — the source of truth; fr.ts and en.ts must match this shape
// (see src/shared/i18n).
const nl = {
  // Shared
  thisOrg: 'deze organisatie',
  busy: 'Bezig...',
  remove: 'Verwijderen',
  name: 'Naam',
  date: 'Datum',
  status: 'Status',

  // Rapporten
  reports: {
    title: 'Rapporten',
    subtitle: (org: string) => `Verkoop en betalingen van ${org}.`,
    period: 'Periode',
    periods: {
      today: 'Vandaag',
      yesterday: 'Gisteren',
      week: 'Deze week',
      month: 'Deze maand',
      custom: 'Aangepast',
    } satisfies Record<Period, string>,
    from: 'Van',
    to: 'Tot en met',
    invalidPeriod: 'Kies een geldige periode (de einddatum ligt niet voor de begindatum).',
    forbidden: 'Verkooprapporten zijn alleen voor beheerders van deze organisatie.',
    loadError: (error: string) => `Kon het rapport niet laden: ${error}`,
    revenue: 'Omzet excl. fooi',
    closedTabs: (count: number, withLegacy: boolean) =>
      `${count} afgesloten rekening${count === 1 ? '' : 'en'}${withLegacy ? ' + oude kassa' : ''}`,
    tips: 'Fooi',
    paymentsTotal: 'Betalingen totaal',
    paymentCount: (count: number) => `${count} betaling${count === 1 ? '' : 'en'}`,
    openTabs: 'Open rekeningen (nu)',
    openCount: (count: number) => `${count} open`,
    byMethod: 'Per betaalmethode',
    method: 'Methode',
    quantity: 'Aantal',
    amount: 'Bedrag',
    ofWhichTip: 'Waarvan fooi',
    byCategory: 'Per categorie',
    category: 'Categorie',
    revenueShort: 'Omzet',
    noCategory: 'Zonder categorie',
    byProduct: 'Per product',
    product: 'Product',
    byVat: 'Per btw-tarief',
    vatProvisional: 'De btw-tarieven zijn voorlopig — nog te bevestigen door de boekhouder.',
    vatRate: 'Tarief',
    revenueInclVat: 'Omzet incl. btw',
    vat: 'Btw',
    legacyTitle: 'Voor de rekeningen (oude kassa)',
    legacySummary: (count: number, amount: string) =>
      `${count} betaling${count === 1 ? '' : 'en'} van voor de rekeningen, samen ${amount} (fooi inbegrepen).`,
    nothingInPeriod: 'Niets in deze periode.',
    paymentsInPeriod: 'Betalingen in deze periode',
    event: 'Evenement',
    allEvents: 'Alle evenementen',
    paymentsLoadError: (error: string) => `Kon betalingen niet laden: ${error}`,
    time: 'Tijdstip',
    description: 'Omschrijving',
    device: 'Toestel',
    user: 'Gebruiker',
    noPayments: 'Geen betalingen in deze periode.',
  },

  // Helpers in lib/reports.ts
  methods: { cash: 'Contant', sumup: 'SumUp', bancontact: 'Bancontact' },
  vatNotSet: 'niet ingesteld',
  vatPercent: (percent: number) => `${String(percent).replace('.', ',')}%`,
  // The old kassa's item keys (transactions.items, before tabs existed).
  // Bonnen/Fietstocht/Wandeltocht are that org's own product names, so
  // they stay as they are in every language; only the wording around them
  // is translated.
  legacyItems: {
    bon: 'Bonnen',
    fietstocht: 'Fietstocht',
    fietstochtMember: 'Fietstocht (lid)',
    wandeltocht: 'Wandeltocht',
    wandeltochtMember: 'Wandeltocht (lid)',
    fooi: 'Fooi',
  },

  // Events
  events: {
    title: 'Evenementen',
    subtitle: (org: string) => `Evenementen van ${org}.`,
    create: 'Nieuw evenement',
    createHint: 'Naam en datum — menukaarten per evenement volgen later.',
    namePlaceholder: 'bv. Elewijtse Pijl 2027',
    submit: 'Aanmaken',
    loadError: (error: string) => `Kon evenementen niet laden: ${error}`,
    empty: 'Nog geen evenementen aangemaakt.',
  },

  // Devices
  devices: {
    addDevice: 'Toestel toevoegen',
    addDeviceHint: 'Een kassa of klantscherm. Je krijgt een koppelcode die je op het toestel ingeeft; ze is 10 minuten geldig en werkt één keer.',
    deviceName: 'Naam',
    namePlaceholderPos: 'bv. Kassa toog',
    namePlaceholderCfd: 'bv. Klantscherm toog',
    makeCode: 'Koppelcode maken',
    busy: 'Bezig...',
    codeHint: (host: string) => `Open op het toestel ${host}, kies "Dit toestel koppelen" en geef deze code in — of scan de QR-code met het toestel.`,
    expiresIn: (time: string) => `Nog ${time} geldig`,
    pairedDevice: (name: string) => `${name} is gekoppeld.`,
    pairedDisplayFor: (name: string, kassa: string) => `${name} is gekoppeld en toont de betalingen van ${kassa}.`,
    forKassa: 'Voor welke kassa?',
    linkLater: 'Later koppelen (in de Instellingen van de kassa)',
    codeExpired: 'Deze code is niet meer geldig.',
    newCode: 'Nieuwe code',
    done: 'Klaar',
    openCodes: 'Openstaande koppelcodes',
    revoke: 'Intrekken',
    codeFor: (name: string, time: string) => `${name} · nog ${time} geldig`,
    confirmRemoveDevice: (name: string) => `${name} verwijderen? Het toestel werkt niet meer tot het opnieuw gekoppeld wordt met een nieuwe code.`,
    removeFailed: (error: string) => `Verwijderen mislukt: ${error}`,
    title: 'Toestellen',
    subtitle: (org: string) => `Alle kassa's, klantschermen en SumUp-readers gekoppeld aan ${org}.`,
    loadError: (error: string) => `Kon toestellen niet laden: ${error}`,
    readersError: (error: string) => `Kon SumUp-readers niet ophalen: ${error}`,
    id: 'Toestel',
    type: 'Type',
    linkedTo: 'Gekoppeld aan',
    registeredAt: 'Geregistreerd op',
    empty: 'Nog geen toestellen geregistreerd voor deze organisatie.',
    roles: { pos: 'Kassa', cfd: 'Klantscherm', sim: 'SumUp-simulator (vervallen)' } satisfies Record<DeviceRole, string>,
    reader: 'SumUp-reader',
    readerStatus: {
      paired: 'Gekoppeld',
      processing: 'Bezig',
      expired: 'Verlopen',
      unknown: 'Onbekend',
    },
    online: 'Online',
    offline: 'Offline',
    confirmRemove: (id: string) => `Toestel ${id} verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    pairReader: 'Reader koppelen',
    pairHint:
      'Kies op de SumUp Solo voor koppelen via API (in de verbindingsinstellingen): hij toont een code van 8 of 9 tekens. ' +
      'De Virtual Solo (virtual-solo.sumup.com, om te testen met een sandbox-account) toont die code meteen.',
    pairingCode: 'Koppelcode',
    readerName: 'Naam',
    pair: 'Koppelen',
    moreInfo: 'Meer uitleg',
    paired: (name: string) => `${name} is gekoppeld. Bevestig op de reader als die erom vraagt; daarna staat hij op "Gekoppeld".`,
    readerActions: (name: string) => `Acties voor ${name}`,
    unpair: 'Loskoppelen',
    confirmUnpair: (name: string) => `${name} loskoppelen van je SumUp-account? Om hem opnieuw te gebruiken, koppel je hem opnieuw met een nieuwe code.`,
    unpairError: (error: string) => `Loskoppelen mislukt: ${error}`,
    footnote:
      'Offline betekent enkel dat er nu geen live verbinding is (bv. het scherm staat uit of de kassa toont een ' +
      'andere pagina) — het toestel en zijn koppeling blijven bestaan. Gebruik "Verwijderen" enkel voor toestellen ' +
      'die echt niet meer gebruikt worden. SumUp-readers worden live opgehaald uit je SumUp-account; koppelen en ' +
      'loskoppelen gaan ook rechtstreeks naar SumUp.',
  },

  // Users
  users: {
    title: 'Gebruikers',
    subtitle: (org: string) => `Leden van ${org} en hun rol.`,
    invite: 'Lid uitnodigen',
    inviteHint: 'Ze krijgen deze rol zodra ze inloggen met dit e-mailadres.',
    emailAddress: 'E-mailadres',
    role: 'Rol',
    cashierOption: 'Kassier',
    adminOption: 'Beheerder',
    submit: 'Uitnodigen',
    loadError: (error: string) => `Kon leden niet laden: ${error}`,
    email: 'E-mail',
    admin: 'Beheerder',
    cashier: 'Kassier',
    active: 'Actief',
    pending: 'In afwachting',
    you: '(jij)',
    confirmRemove: (email: string) => `${email} verwijderen uit deze organisatie?`,
    copyInvite: 'Uitnodiging kopiëren',
    shareTitle: 'Uitnodiging doorgeven',
    shareNotSent: (email: string) => `Er is geen uitnodigingsmail naar ${email} verstuurd (deze installatie heeft geen werkende mail). Bezorg deze uitnodiging zelf, bv. via WhatsApp of sms.`,
    shareHint: (email: string) => `Bezorg ${email} deze uitnodiging, bv. via WhatsApp of sms.`,
    shareText: 'Uitnodiging',
    copy: 'Kopiëren',
    copied: 'Gekopieerd',
    close: 'Sluiten',
  },

  // Org import (components/org-import-dialog.tsx, lib/org-transfer.ts)
  orgImport: {
    resumeTitle: 'Import hervatten',
    title: 'Organisatie importeren',
    resumeHint: (org: string) => `Kies hetzelfde exportbestand opnieuw om de import van "${org}" af te werken.`,
    hint: 'Maakt een nieuwe organisatie aan met alle gegevens uit een Arcanum-exportbestand. Jij wordt er beheerder van.',
    file: 'Exportbestand (.json)',
    orgName: 'Naam van de organisatie',
    withSecrets: 'Dit bestand bevat betaalinstellingen; die worden opnieuw versleuteld met de sleutel van de nieuwe organisatie.',
    withoutSecrets: 'Dit bestand bevat geen betaalinstellingen — stel die na de import zelf opnieuw in.',
    membersAsInvites: 'Leden komen terug als uitnodiging en worden actief bij hun eerste login.',
    progress: (done: number, total: number) => `Bezig met importeren… ${done} / ${total} rijen`,
    done: 'Import voltooid.',
    mismatch: 'Niet alle gegevens zijn aangekomen. Opnieuw proberen is veilig — niets wordt dubbel geïmporteerd.',
    mismatchLine: (table: string, imported: number, expected: number) => `${table}: ${imported} van ${expected}`,
    failed: (error: string) => `De import is onderbroken: ${error}`,
    otherFile: 'Ander bestand',
    resume: 'Hervatten',
    import: 'Importeren',
    goToOrg: 'Naar de nieuwe organisatie',
    abort: 'Import annuleren',
    retry: 'Opnieuw proberen',
    // Why a picked file can't be imported (lib/org-transfer.ts's FileProblem).
    problems: {
      invalidJson: 'Dit bestand is geen geldige JSON.',
      notExport: 'Dit is geen Arcanum-exportbestand.',
      version: (version: string, expected: number) => `Exportversie ${version} wordt niet ondersteund (verwacht ${expected}).`,
      noOrganization: 'Het bestand bevat geen organisatie.',
      incomplete: 'Het bestand is onvolledig of beschadigd (tabellen ontbreken).',
    },
    // Human-readable table names for the summary and the report.
    tables: {
      memberships: 'Leden (als uitnodiging)',
      events: 'Evenementen',
      categories: 'Categorieën',
      prep_stations: 'Stations',
      products: 'Producten',
      product_variants: 'Varianten',
      catalogs: 'Menukaarten',
      catalog_sections: 'Groepen',
      catalog_entries: 'Menukaartlijnen',
      org_counters: 'Tellers (rekening-/ticketnummers)',
      tabs: 'Rekeningen',
      orders: 'Bestellingen',
      order_lines: 'Bestellijnen',
      charges: 'Betalingen',
      transactions: 'Transacties',
      payment_provider_credentials: 'Betaalinstellingen (geheim)',
    } satisfies Record<ExportTable, string>,
  },
}

export type AdminOrgMessages = typeof nl
export default nl
