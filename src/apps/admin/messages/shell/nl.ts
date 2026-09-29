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
  copy: 'Kopiëren',
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
    notifications: 'Meldingen',
    branding: 'Huisstijl',
    authentication: 'Aanmelding',
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

  // Settings → Notifications
  notificationsSubtitle: 'E-mailconfiguratie voor deze organisatie. Laat leeg om het platform-standaardaccount te blijven gebruiken.',
  mailLoadFailed: (error: string) => `Kon e-mailconfiguratie niet laden: ${error}`,
  mailAccount: 'E-mailaccount',
  passwordSet: 'Status: wachtwoord ingesteld',
  passwordNotSet: 'Status: nog geen wachtwoord ingesteld',
  serviceAccountSet: 'Status: service account ingesteld',
  serviceAccountNotSet: 'Status: nog geen service account ingesteld',
  sendMethod: 'Verzendmethode',
  gmailApiOption: 'Gmail API (service account)',
  host: 'Host',
  port: 'Poort',
  username: 'Gebruikersnaam',
  password: 'Wachtwoord',
  passwordHint: '(app-wachtwoord — alleen invullen om te wijzigen)',
  fromAddress: 'Afzenderadres',
  fromName: 'Afzendernaam',
  serviceAccountFile: 'Service-account JSON-bestand',
  serviceAccountFileHint: '(uit Google Cloud Console — alleen invullen om te wijzigen)',
  serviceAccountFileIncomplete: 'Bestand mist client_email of private_key',
  clientEmail: (email: string) => `Client e-mail: ${email}`,
  sendAs: 'Verzenden als',
  sendAsHint: '(Workspace-adres met domain-wide delegation)',
  sendAsPlaceholder: 'admin@jouwdomein.be',
  sendTestMail: 'Verstuur testmail',
  testMailSent: 'Testmail verstuurd — controleer je inbox.',
  testMailFailed: (error: string) => `Mislukt: ${error}`,
  mailNotifications: 'E-mailmeldingen',
  mailNotificationsHint: 'Voorbeeld van welke meldingen hier komen — nog niet configureerbaar per type.',
  plannedNotifications: {
    invite: { label: 'Nieuwe uitnodiging', description: 'E-mail wanneer iemand wordt uitgenodigd voor deze organisatie.' },
    paymentFailed: { label: 'Mislukte betaling', description: 'E-mail bij een mislukte of verlopen betaling.' },
  },

  // Settings → Branding
  removeDomainConfirm: (domain: string) => `${domain} verwijderen als aangepast domein?`,
  brandingSubtitle: 'Optioneel: maak deze organisatie bereikbaar op een eigen domeinnaam in plaats van het standaardadres van dit platform.',
  domainLoadFailed: (error: string) => `Kon domeininstellingen niet laden: ${error}`,
  customDomain: 'Aangepast domein',
  noDomainYet: 'Nog geen domein ingesteld',
  active: 'Actief',
  awaitingVerification: 'Wachten op verificatie',
  inProgress: 'Bezig',
  domainName: 'Domeinnaam',
  domainPlaceholder: 'pos.mijnorganisatie.be',
  change: 'Wijzigen',
  setUp: 'Instellen',
  // Around the domain name, shown as code.
  cnameBefore: 'Maak bij je domeinprovider een CNAME-record aan dat ',
  cnameAfter: ' naar het volgende adres verwijst:',
  verify: 'Verifiëren',
  domainActive: 'Domein geverifieerd en actief.',
  domainNotActiveYet: (status: string, sslStatus: string) =>
    `Nog niet actief (status: ${status} / ssl: ${sslStatus}). Dit kan enkele minuten duren nadat de CNAME zichtbaar is — klik op Verifiëren om de status te vernieuwen.`,
  remove: 'Verwijderen',
  domainNeedsOwnIdp:
    'Vereist een eigen identity provider voor deze organisatie (zie Aanmelding) — leden melden zich na het instellen aan via dit domein zelf, niet meer via het standaardadres van dit platform.',

  // Settings → Authentication
  authenticationSubtitle:
    'Optioneel: laat leden van deze organisatie inloggen via een eigen identity provider (bv. Google Workspace, Microsoft Entra ID, Keycloak) in plaats van het platform-standaardaccount. Laat leeg om de standaard te blijven gebruiken.',
  idpLoadFailed: (error: string) => `Kon identity provider niet laden: ${error}`,
  identityProvider: 'Identity provider',
  clientSecretSet: 'Status: client-secret ingesteld',
  clientSecretNotSet: 'Status: nog geen client-secret ingesteld',
  issuerUrl: 'Issuer-URL',
  deviceClientId: 'Client-ID voor device code flow',
  clientSecret: 'Client-secret',
  fillInToChange: 'Alleen invullen om te wijzigen.',
  authCodeClientId: 'Client-ID voor authorization code flow (optioneel)',
  authCodeClientHint: 'Alleen nodig als deze identity provider een aparte client per flow vereist. Leeg = gebruik de client hierboven voor beide.',
  fillInToChangeState: (isSet: boolean) => `Alleen invullen om te wijzigen (${isSet ? 'momenteel ingesteld' : 'momenteel niet ingesteld'}).`,
  // Around the callback URL, shown as code.
  redirectUriBefore: (domain: string) =>
    `Deze organisatie heeft een aangepast domein (${domain}) en een eigen client voor authorization code flow — vergeet niet om `,
  redirectUriAfter: ' te registreren als toegestane redirect-URI bij deze identity provider zelf.',
  scopes: 'Scopes (optioneel)',
  scopesHint:
    "Spatie-gescheiden — standaard 'openid profile email offline_access'. Google accepteert geen 'offline_access'; gebruik dan bv. 'openid profile email'.",
  loginLinks: 'Aanmeldlinks',
  deviceLinkHint: 'Gebruik deze link om aan te melden op een toestel:',
  consoleLinkHint: 'Gebruik deze link om aan te melden in het beheerportaal:',

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
  includeSecrets: 'Inclusief geheimen (betaal- en mailinstellingen, onversleuteld)',
  secretsWarning:
    'Het bestand bevat dan wachtwoorden en API-sleutels in leesbare vorm (Bancontact, SumUp, SMTP, Gmail). Bewaar het veilig, deel het niet, en verwijder het na de import.',
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
