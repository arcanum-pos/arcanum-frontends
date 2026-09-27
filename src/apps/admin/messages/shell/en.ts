import type { AdminShellMessages } from './nl'

export default {
  // Shared
  busy: 'Working...',
  cancel: 'Cancel',
  save: 'Save',
  saved: 'Saved.',
  loading: 'Loading...',
  copy: 'Copy',
  custom: 'Custom',
  platformDefault: 'Platform default',
  thisOrg: 'this organisation',

  // Footer
  servedBy: 'Served to you by kaboutersoft.be',
  freeSoftware: 'Arcanum is free software (AGPL-3.0)',
  sourceCode: 'Source code',
  installedVersion: 'The installed version of Arcanum',

  // Sidebar
  nav: {
    dashboard: 'Dashboard',
    reports: 'Reports',
    events: 'Events',
    products: 'Products',
    catalogs: 'Menus',
    devices: 'Devices',
    users: 'Users',
    settings: 'Settings',
  },
  installer: 'Installation',
  profile: 'Profile',
  logout: 'Log out',

  // Org switcher
  noOrg: 'No organisation',
  organisation: 'Organisation',
  organisations: 'Organisations',
  newOrg: 'New organisation',
  createOrgTitle: 'Create a new organisation',
  createOrgDescription: 'You automatically become an administrator (admin) of this organisation.',
  name: 'Name',
  orgNamePlaceholder: 'e.g. Scouts Elewijt',
  importInstead: 'or import from an export file',
  create: 'Create',

  // Unfinished-import banner
  abortImportConfirm: (name: string) => `Delete the unfinished import of "${name}" and everything already imported?`,
  importUnfinished: 'This import did not finish',
  importUnfinishedHint: 'Resume with the same export file, or cancel to remove this organisation again.',
  resume: 'Resume',

  // Dashboard
  dashboardSubtitle: 'Sales figures for the current organisation.',
  kpis: {
    revenueToday: 'Revenue today',
    transactionsToday: 'Transactions today',
    averageReceipt: 'Average receipt',
    activeEvent: 'Active event',
  },
  salesOverTime: 'Sales over time',
  notImplemented: 'Not implemented yet — reserved space.',
  chartComing: 'Chart coming soon',

  // Settings: the side menu, also each page's heading
  settingsNav: {
    appearance: 'Appearance',
    preferences: 'Preferences',
    profile: 'Profile',
    paymentProviders: 'Payment providers',
    notifications: 'Notifications',
    branding: 'Branding',
    authentication: 'Authentication',
    data: 'Data',
  },

  // Settings → Appearance
  appearanceSubtitle: 'Choose a light or dark theme, or follow your system setting.',
  theme: 'Theme',
  themeRemembered: 'Remembered on this device.',
  themes: { light: 'Light', dark: 'Dark', system: 'System' },

  // Settings → Preferences
  preferencesSubtitle: 'Personal preferences for this interface.',
  language: 'Language',
  languageHint:
    'The language of this admin portal, remembered in this browser. Tills and customer displays each have their own language (Settings → Language).',
  orgLanguage: 'Organisation language',
  orgLanguageHint: (org: string) =>
    `${org}’s default language: for the emails it sends (such as invitations) and for a new till device, until someone picks another language there.`,
  orgLanguageSaved: 'Saved.',
  orgLanguageFailed: (error: string) => `Could not save the language: ${error}`,

  // Settings → Profile
  profileSubtitle: 'Your identity, as confirmed by your identity provider.',
  profileLoadFailed: (error: string) => `Could not load profile: ${error}`,
  whoAmI: 'Who am I',
  profileReadOnly: 'Read-only — change this at your identity provider itself.',
  email: 'Email',

  // Settings → Payment Providers
  paymentProvidersSubtitle: (org: string) => `Payment providers linked to ${org}.`,
  paymentProvidersLoadFailed: (error: string) => `Could not load payment providers: ${error}`,
  configured: 'Configured',
  notConfigured: 'Not configured',
  setKeys: 'Set keys',
  keysTitle: (provider: string) => `${provider} — keys`,
  keysEncrypted: 'Stored encrypted (envelope encryption per organisation).',
  merchantCode: 'Merchant code',
  apiKey: 'API key',
  environment: 'Environment',
  production: 'Production',
  preprod: 'Test (preprod)',

  // Settings → Notifications
  notificationsSubtitle: 'Email configuration for this organisation. Leave empty to keep using the platform default account.',
  mailLoadFailed: (error: string) => `Could not load email configuration: ${error}`,
  mailAccount: 'Email account',
  passwordSet: 'Status: password set',
  passwordNotSet: 'Status: no password set yet',
  serviceAccountSet: 'Status: service account set',
  serviceAccountNotSet: 'Status: no service account set yet',
  sendMethod: 'Sending method',
  gmailApiOption: 'Gmail API (service account)',
  host: 'Host',
  port: 'Port',
  username: 'Username',
  password: 'Password',
  passwordHint: '(app password — only fill in to change it)',
  fromAddress: 'Sender address',
  fromName: 'Sender name',
  serviceAccountFile: 'Service account JSON file',
  serviceAccountFileHint: '(from Google Cloud Console — only fill in to change it)',
  serviceAccountFileIncomplete: 'File is missing client_email or private_key',
  clientEmail: (email: string) => `Client email: ${email}`,
  sendAs: 'Send as',
  sendAsHint: '(Workspace address with domain-wide delegation)',
  sendAsPlaceholder: 'admin@yourdomain.be',
  sendTestMail: 'Send test email',
  testMailSent: 'Test email sent — check your inbox.',
  testMailFailed: (error: string) => `Failed: ${error}`,
  mailNotifications: 'Email notifications',
  mailNotificationsHint: 'A preview of the notifications that will appear here — not yet configurable per type.',
  plannedNotifications: {
    invite: { label: 'New invitation', description: 'Email when someone is invited to this organisation.' },
    paymentFailed: { label: 'Failed payment', description: 'Email on a failed or expired payment.' },
  },

  // Settings → Branding
  removeDomainConfirm: (domain: string) => `Remove ${domain} as custom domain?`,
  brandingSubtitle: 'Optional: make this organisation reachable on its own domain name instead of this platform’s default address.',
  domainLoadFailed: (error: string) => `Could not load domain settings: ${error}`,
  customDomain: 'Custom domain',
  noDomainYet: 'No domain set up yet',
  active: 'Active',
  awaitingVerification: 'Awaiting verification',
  inProgress: 'In progress',
  domainName: 'Domain name',
  domainPlaceholder: 'pos.myorganisation.be',
  change: 'Change',
  setUp: 'Set up',
  cnameBefore: 'At your domain provider, create a CNAME record that points ',
  cnameAfter: ' to the following address:',
  verify: 'Verify',
  domainActive: 'Domain verified and active.',
  domainNotActiveYet: (status: string, sslStatus: string) =>
    `Not active yet (status: ${status} / ssl: ${sslStatus}). This can take a few minutes after the CNAME becomes visible — click Verify to refresh the status.`,
  remove: 'Remove',
  domainNeedsOwnIdp:
    'Requires this organisation’s own identity provider (see Authentication) — once it’s set up, members sign in through this domain itself, no longer through this platform’s default address.',

  // Settings → Authentication
  authenticationSubtitle:
    'Optional: let members of this organisation sign in through their own identity provider (e.g. Google Workspace, Microsoft Entra ID, Keycloak) instead of the platform default account. Leave empty to keep using the default.',
  idpLoadFailed: (error: string) => `Could not load identity provider: ${error}`,
  identityProvider: 'Identity provider',
  clientSecretSet: 'Status: client secret set',
  clientSecretNotSet: 'Status: no client secret set yet',
  issuerUrl: 'Issuer URL',
  deviceClientId: 'Client ID for device code flow',
  clientSecret: 'Client secret',
  fillInToChange: 'Only fill in to change it.',
  authCodeClientId: 'Client ID for authorization code flow (optional)',
  authCodeClientHint: 'Only needed if this identity provider requires a separate client per flow. Empty = use the client above for both.',
  fillInToChangeState: (isSet: boolean) => `Only fill in to change it (${isSet ? 'currently set' : 'currently not set'}).`,
  redirectUriBefore: (domain: string) =>
    `This organisation has a custom domain (${domain}) and its own client for authorization code flow — don’t forget to register `,
  redirectUriAfter: ' as an allowed redirect URI with this identity provider itself.',
  scopes: 'Scopes (optional)',
  scopesHint: "Space-separated — default 'openid profile email offline_access'. Google doesn't accept 'offline_access'; use e.g. 'openid profile email' instead.",
  loginLinks: 'Sign-in links',
  deviceLinkHint: 'Use this link to sign in on a device:',
  consoleLinkHint: 'Use this link to sign in to the admin portal:',

  // Settings → Gegevens
  dataSubtitle: 'Take all your data with you — for example to your own Arcanum installation on your own Cloudflare account.',
  exportTitle: 'Export',
  exportDescription: (org: string) =>
    `One readable JSON file with all the data of ${org}: members, events, products, menus, bills, orders, payments and transactions.`,
  notInExport: 'Not in the export',
  notInExportKey: 'the organisation’s encryption key (an import creates a new one)',
  notInExportDomain: 'the custom domain and the identity provider — they belong to an installation',
  notInExportDevices: 'devices (tills, customer displays) — they register again',
  notInExportMembers: 'on import, members come back as invitations and become active on their first login',
  includeSecrets: 'Include secrets (payment and email settings, unencrypted)',
  secretsWarning:
    'The file will then contain passwords and API keys in readable form (Bancontact, SumUp, SMTP, Gmail). Keep it safe, don’t share it, and delete it after the import.',
  exporting: 'Working…',
  exportAll: 'Export all data',
  exportFailed: (error: string) => `Export failed: ${error}`,
  importTitle: 'Import',
  importDescription:
    'Creates a new organisation with all the data from an export file — from this or another Arcanum installation. The current organisation stays unchanged.',
  importFromFile: 'Import an organisation from an export file',
} satisfies AdminShellMessages
