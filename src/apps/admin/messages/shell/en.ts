import type { AdminShellMessages } from './nl'

export default {
  // Shared
  busy: 'Working...',
  cancel: 'Cancel',
  save: 'Save',
  saved: 'Saved.',
  loading: 'Loading...',
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
  createOrgDescription: 'You automatically become an administrator of this organisation.',
  name: 'Name',
  orgNamePlaceholder: 'e.g. Scouts Elewijt',
  importInstead: 'or import from an export file',
  firstOrgTitle: 'Welcome to your Arcanum',
  firstOrgText: 'Give your organisation a name to begin — your club, youth movement or event. You become its administrator.',
  firstOrgCreate: 'Create organisation',
  firstOrgImport: 'or import an organisation from an export file (e.g. your demo)',
  noMembershipTitle: 'You’re not a member of an organisation',
  noMembershipText: (email: string) => `You’re signed in as ${email}, but that address doesn’t belong to any organisation on this Arcanum.`,
  noMembershipInvite: 'Ask an admin of your organisation to invite you at this address. Already invited? Then sign in with exactly the address the invitation went to — and the same way (password, Google or passkey).',
  noMembershipSignOut: 'Sign out and use another account',
  demoTitle: (when: string) => `This is a demo — it disappears by itself at ${when}.`,
  demoHint: 'Feel free to try everything. Want to keep going? Take your demo along as an export file, or create your own installation.',
  demoTakeAlong: 'Take your demo along',
  demoOwnInstall: 'Own installation',
  importNotHere: 'You cannot import organisations on this installation. Import your export file into your own installation.',
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
  providerHelp: {
    bancontact: 'The customer scans a QR code on the customer display with the Bancontact app. You need a Bancontact Pro contract and the API key from the Bancontact Pro portal. Testing happens in Bancontact’s test environment (preprod), on request.',
    sumup: 'Card payments on a SumUp Solo. You need your merchant code and an API key from your SumUp dashboard; then pair the reader under Devices. Testing without real money: a sandbox account and the Virtual Solo.',
  },
  moreInfo: 'More information',

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
  includeSecrets: 'Include secrets (payment settings, unencrypted)',
  secretsWarning:
    'The file will then contain passwords and API keys in readable form (Bancontact, SumUp). Keep it safe, don’t share it, and delete it after the import.',
  exporting: 'Working…',
  exportAll: 'Export all data',
  exportFailed: (error: string) => `Export failed: ${error}`,
  importTitle: 'Import',
  importDescription:
    'Creates a new organisation with all the data from an export file — from this or another Arcanum installation. The current organisation stays unchanged.',
  importFromFile: 'Import an organisation from an export file',
} satisfies AdminShellMessages
