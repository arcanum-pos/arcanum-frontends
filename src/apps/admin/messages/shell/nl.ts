// The admin console's "shell" texts — the source of truth; fr.ts and en.ts
// must match this shape (see src/shared/i18n). The frame around every page
// (sidebar, org switcher, footer), the dashboard and the Settings pages.
// Some nl texts are still English (the Settings page names): that's what a
// Dutch admin sees today, kept as is.
const nl = {
  // Shared
  busy: 'Bezig...',
  cancel: 'Annuleren',
  save: 'Opslaan',
  saved: 'Opgeslagen.',
  loading: 'Laden...',
  custom: 'Aangepast',
  platformDefault: 'Platform-standaard',
  thisOrg: 'deze organisatie',

  // Footer
  servedBy: 'Voor u geserveerd door kaboutersoft.be',
  freeSoftware: 'Arcanum is vrije software (AGPL-3.0)',
  sourceCode: 'Broncode',
  installedVersion: 'De geïnstalleerde versie van Arcanum',

  // Sidebar
  nav: {
    dashboard: 'Overzicht',
    reports: 'Rapporten',
    events: 'Evenementen',
    products: 'Producten',
    catalogs: 'Menukaarten',
    devices: 'Toestellen',
    users: 'Gebruikers',
    settings: 'Instellingen',
  },
  installer: 'Installatie',
  profile: 'Profiel',
  logout: 'Afmelden',

  // Org switcher
  noOrg: 'Geen organisatie',
  organisation: 'Organisatie',
  organisations: 'Organisaties',
  newOrg: 'Nieuwe organisatie',
  createOrgTitle: 'Nieuwe organisatie aanmaken',
  createOrgDescription: 'Je wordt automatisch beheerder van deze organisatie.',
  name: 'Naam',
  orgNamePlaceholder: 'bv. Scouts Elewijt',
  importInstead: 'of importeer uit een exportbestand',
  // Demo org banner
  firstOrgTitle: 'Welkom bij je Arcanum',
  firstOrgText: 'Geef je organisatie een naam om te beginnen — je vereniging, jeugdbeweging of evenement. Je wordt er de beheerder van.',
  firstOrgCreate: 'Organisatie aanmaken',
  firstOrgImport: 'of importeer een organisatie uit een exportbestand (bv. je demo)',
  noMembershipTitle: 'Je bent geen lid van een organisatie',
  noMembershipText: (email: string) => `Je bent aangemeld als ${email}, maar dat adres hoort bij geen enkele organisatie op deze Arcanum.`,
  noMembershipInvite: 'Vraag een beheerder van je organisatie om je uit te nodigen op dit adres. Werd je al uitgenodigd? Meld je dan aan met precies het adres waarop de uitnodiging kwam — en op dezelfde manier (wachtwoord, Google of passkey).',
  noMembershipSignOut: 'Afmelden en een ander account gebruiken',
  demoTitle: (when: string) => `Dit is een demo — ze verdwijnt vanzelf om ${when}.`,
  demoHint: 'Probeer gerust alles uit. Wil je verder? Neem je demo mee als exportbestand, of maak je eigen installatie.',
  demoTakeAlong: 'Neem je demo mee',
  demoOwnInstall: 'Eigen installatie',
  importNotHere: 'Op deze installatie kan je geen organisaties importeren. Importeer je exportbestand in je eigen installatie.',
  create: 'Aanmaken',

  // Unfinished-import banner
  abortImportConfirm: (name: string) => `De onafgewerkte import van "${name}" en alles wat al geïmporteerd werd verwijderen?`,
  importUnfinished: 'Deze import is niet afgewerkt',
  importUnfinishedHint: 'Hervat met hetzelfde exportbestand, of annuleer om deze organisatie weer te verwijderen.',
  resume: 'Hervatten',

  // Dashboard
  dashboardSubtitle: 'Verkoopcijfers voor de huidige organisatie.',
  kpis: {
    revenueToday: 'Omzet vandaag',
    transactionsToday: 'Transacties vandaag',
    averageReceipt: 'Gemiddeld bonbedrag',
    activeEvent: 'Actief evenement',
  },
  salesOverTime: 'Verkoop over tijd',
  notImplemented: 'Nog niet geïmplementeerd — gereserveerde ruimte.',
  chartComing: 'Grafiek volgt',

  // Settings: the side menu, also each page's heading
  settingsNav: {
    appearance: 'Weergave',
    preferences: 'Voorkeuren',
    profile: 'Profiel',
    paymentProviders: 'Betaalproviders',
    data: 'Gegevens',
  },

  // Settings → Appearance
  appearanceSubtitle: 'Kies een licht of donker thema, of volg je systeeminstelling.',
  theme: 'Thema',
  themeRemembered: 'Wordt onthouden op dit toestel.',
  themes: { light: 'Licht', dark: 'Donker', system: 'Systeem' },

  // Settings → Preferences
  preferencesSubtitle: 'Persoonlijke voorkeuren voor deze interface.',
  language: 'Taal',
  languageHint:
    "De taal van dit beheerportaal, onthouden in deze browser. Kassa's en klantschermen hebben elk hun eigen taal (Instellingen → Taal).",
  orgLanguage: 'Taal van de organisatie',
  orgLanguageHint: (org: string) =>
    `De standaardtaal van ${org}: voor de e-mails die ze verstuurt (zoals uitnodigingen) en voor een nieuw kassatoestel, tot iemand er een andere taal kiest.`,
  orgLanguageSaved: 'Opgeslagen.',
  orgLanguageFailed: (error: string) => `Kon de taal niet opslaan: ${error}`,

  // Settings → Profile
  profileSubtitle: 'Je identiteit, zoals bevestigd door je identity provider.',
  profileLoadFailed: (error: string) => `Kon profiel niet laden: ${error}`,
  whoAmI: 'Wie ben ik',
  profileReadOnly: 'Alleen-lezen — wijzig dit bij je identity provider zelf.',
  email: 'E-mail',

  // Settings → Payment Providers
  paymentProvidersSubtitle: (org: string) => `Betaalproviders gekoppeld aan ${org}.`,
  paymentProvidersLoadFailed: (error: string) => `Kon betaalproviders niet laden: ${error}`,
  configured: 'Geconfigureerd',
  notConfigured: 'Niet geconfigureerd',
  setKeys: 'Sleutels instellen',
  keysTitle: (provider: string) => `${provider} — sleutels`,
  keysEncrypted: 'Worden versleuteld opgeslagen (envelope encryption per organisatie).',
  merchantCode: 'Merchant code',
  apiKey: 'API-key',
  environment: 'Omgeving',
  production: 'Productie',
  preprod: 'Test (preprod)',
  providerHelp: {
    bancontact: 'De klant scant een QR-code op het klantscherm met de Bancontact-app. Nodig: een Bancontact Pro-contract en de API-sleutel uit het Bancontact Pro-portaal. Testen kan in Bancontacts testomgeving (preprod), op aanvraag.',
    sumup: 'Kaartbetalingen op een SumUp Solo. Nodig: je merchant code en een API-sleutel uit je SumUp-dashboard; koppel de reader daarna bij Toestellen. Testen zonder echt geld: een sandbox-account en de Virtual Solo.',
  },
  moreInfo: 'Meer uitleg',

  // Settings → Gegevens
  dataSubtitle: 'Al je gegevens meenemen — bijvoorbeeld naar een eigen Arcanum-installatie op je eigen Cloudflare-account.',
  exportTitle: 'Exporteren',
  exportDescription: (org: string) =>
    `Eén leesbaar JSON-bestand met alle gegevens van ${org}: leden, evenementen, producten, menukaarten, rekeningen, bestellingen, betalingen en transacties.`,
  notInExport: 'Niet in de export',
  notInExportKey: 'de versleutelingssleutel van de organisatie (een import maakt een nieuwe)',
  notInExportDomain: 'het eigen domein en de identity provider — die horen bij een installatie',
  notInExportDevices: "toestellen (kassa's, klantschermen) — die registreren zich opnieuw",
  notInExportMembers: 'leden komen bij een import terug als uitnodiging en worden actief bij hun eerste login',
  includeSecrets: 'Inclusief geheimen (betaalinstellingen, onversleuteld)',
  secretsWarning:
    'Het bestand bevat dan wachtwoorden en API-sleutels in leesbare vorm (Bancontact, SumUp). Bewaar het veilig, deel het niet, en verwijder het na de import.',
  exporting: 'Bezig…',
  exportAll: 'Alle gegevens exporteren',
  exportFailed: (error: string) => `Export mislukt: ${error}`,
  importTitle: 'Importeren',
  importDescription:
    'Maakt een nieuwe organisatie aan met alle gegevens uit een exportbestand — van deze of een andere Arcanum-installatie. De huidige organisatie blijft ongewijzigd.',
  importFromFile: 'Organisatie importeren uit exportbestand',
}

export type AdminShellMessages = typeof nl
export default nl
