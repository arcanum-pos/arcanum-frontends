import type { AdminShellMessages } from './nl'

export default {
  // Shared
  busy: 'En cours...',
  cancel: 'Annuler',
  save: 'Enregistrer',
  saved: 'Enregistré.',
  loading: 'Chargement...',
  custom: 'Personnalisé',
  platformDefault: 'Par défaut (plateforme)',
  thisOrg: 'cette organisation',

  // Footer
  servedBy: 'Servi par kaboutersoft.be',
  freeSoftware: 'Arcanum est un logiciel libre (AGPL-3.0)',
  sourceCode: 'Code source',
  installedVersion: 'La version installée d’Arcanum',

  // Sidebar
  nav: {
    dashboard: 'Tableau de bord',
    reports: 'Rapports',
    events: 'Événements',
    products: 'Produits',
    catalogs: 'Cartes',
    devices: 'Appareils',
    users: 'Utilisateurs',
    settings: 'Paramètres',
  },
  installer: 'Installation',
  profile: 'Profil',
  logout: 'Se déconnecter',

  // Org switcher
  noOrg: 'Aucune organisation',
  organisation: 'Organisation',
  organisations: 'Organisations',
  newOrg: 'Nouvelle organisation',
  createOrgTitle: 'Créer une nouvelle organisation',
  createOrgDescription: 'Vous en devenez automatiquement administrateur.',
  name: 'Nom',
  orgNamePlaceholder: 'p. ex. Scouts Elewijt',
  importInstead: 'ou importez depuis un fichier d’export',
  firstOrgTitle: 'Bienvenue dans votre Arcanum',
  firstOrgText: 'Donnez un nom à votre organisation pour commencer — votre association, mouvement de jeunesse ou événement. Vous en devenez l’administrateur.',
  firstOrgCreate: 'Créer l’organisation',
  firstOrgImport: 'ou importez une organisation depuis un fichier d’export (p. ex. votre démo)',
  noMembershipTitle: 'Vous n’êtes membre d’aucune organisation',
  noMembershipText: (email: string) => `Vous êtes connecté en tant que ${email}, mais cette adresse n’appartient à aucune organisation sur cet Arcanum.`,
  noMembershipInvite: 'Demandez à un administrateur de votre organisation de vous inviter à cette adresse. Déjà invité ? Connectez-vous alors avec exactement l’adresse qui a reçu l’invitation — et de la même façon (mot de passe, Google ou passkey).',
  noMembershipSignOut: 'Se déconnecter et utiliser un autre compte',
  demoTitle: (when: string) => `Ceci est une démo — elle disparaît d’elle-même à ${when}.`,
  demoHint: 'Essayez tout librement. Vous voulez continuer ? Emportez votre démo en fichier d’export, ou créez votre propre installation.',
  demoTakeAlong: 'Emporter ma démo',
  demoOwnInstall: 'Ma propre installation',
  importNotHere: 'Sur cette installation, vous ne pouvez pas importer d’organisation. Importez votre fichier d’export dans votre propre installation.',
  create: 'Créer',

  // Unfinished-import banner
  abortImportConfirm: (name: string) => `Supprimer l’import inachevé de « ${name} » et tout ce qui a déjà été importé ?`,
  importUnfinished: 'Cet import n’est pas terminé',
  importUnfinishedHint: 'Reprenez avec le même fichier d’export, ou annulez pour supprimer à nouveau cette organisation.',
  resume: 'Reprendre',

  // Dashboard
  dashboardSubtitle: 'Chiffres de vente de l’organisation actuelle.',
  kpis: {
    revenueToday: 'Chiffre d’affaires du jour',
    transactionsToday: 'Transactions du jour',
    averageReceipt: 'Montant moyen par ticket',
    activeEvent: 'Événement actif',
  },
  salesOverTime: 'Ventes dans le temps',
  notImplemented: 'Pas encore implémenté — espace réservé.',
  chartComing: 'Graphique à venir',

  // Settings: the side menu, also each page's heading
  settingsNav: {
    appearance: 'Apparence',
    preferences: 'Préférences',
    profile: 'Profil',
    paymentProviders: 'Prestataires de paiement',
    data: 'Données',
  },

  // Settings → Appearance
  appearanceSubtitle: 'Choisissez un thème clair ou sombre, ou suivez le réglage de votre système.',
  theme: 'Thème',
  themeRemembered: 'Mémorisé sur cet appareil.',
  themes: { light: 'Clair', dark: 'Sombre', system: 'Système' },

  // Settings → Preferences
  preferencesSubtitle: 'Préférences personnelles pour cette interface.',
  language: 'Langue',
  languageHint:
    'La langue de ce portail d’administration, mémorisée dans ce navigateur. Les caisses et les écrans clients ont chacun leur propre langue (Paramètres → Langue).',
  orgLanguage: 'Langue de l’organisation',
  orgLanguageHint: (org: string) =>
    `La langue par défaut de ${org} : pour les e-mails qu’elle envoie (comme les invitations) et pour un nouvel appareil de caisse, jusqu’à ce que quelqu’un y choisisse une autre langue.`,
  orgLanguageSaved: 'Enregistré.',
  orgLanguageFailed: (error: string) => `Impossible d’enregistrer la langue : ${error}`,

  // Settings → Profile
  profileSubtitle: 'Votre identité, telle que confirmée par votre fournisseur d’identité.',
  profileLoadFailed: (error: string) => `Impossible de charger le profil : ${error}`,
  whoAmI: 'Qui suis-je',
  profileReadOnly: 'Lecture seule — modifiez ces données auprès de votre fournisseur d’identité.',
  email: 'E-mail',

  // Settings → Payment Providers
  paymentProvidersSubtitle: (org: string) => `Prestataires de paiement liés à ${org}.`,
  paymentProvidersLoadFailed: (error: string) => `Impossible de charger les prestataires de paiement : ${error}`,
  configured: 'Configuré',
  notConfigured: 'Non configuré',
  setKeys: 'Configurer les clés',
  keysTitle: (provider: string) => `${provider} — clés`,
  keysEncrypted: 'Enregistrées de manière chiffrée (envelope encryption par organisation).',
  merchantCode: 'Code marchand (merchant code)',
  apiKey: 'Clé API',
  environment: 'Environnement',
  production: 'Production',
  preprod: 'Test (préprod)',
  providerHelp: {
    bancontact: 'Le client scanne un QR code sur l’écran client avec l’app Bancontact. Il faut : un contrat Bancontact Pro et la clé API du portail Bancontact Pro. Les tests se font dans l’environnement de test de Bancontact (préprod), sur demande.',
    sumup: 'Paiements par carte sur une SumUp Solo. Il faut : votre code marchand et une clé API de votre tableau de bord SumUp ; couplez ensuite le lecteur dans Appareils. Tester sans argent réel : un compte sandbox et la Virtual Solo.',
  },
  moreInfo: 'En savoir plus',

  // Settings → Gegevens
  dataSubtitle: 'Emportez toutes vos données — par exemple vers votre propre installation Arcanum sur votre propre compte Cloudflare.',
  exportTitle: 'Exporter',
  exportDescription: (org: string) =>
    `Un fichier JSON lisible avec toutes les données de ${org} : membres, événements, produits, cartes, additions, commandes, paiements et transactions.`,
  notInExport: 'Pas dans l’export',
  notInExportKey: 'la clé de chiffrement de l’organisation (un import en crée une nouvelle)',
  notInExportDomain: 'le domaine personnalisé et le fournisseur d’identité — ils appartiennent à une installation',
  notInExportDevices: 'les appareils (caisses, écrans clients) — ils s’enregistrent à nouveau',
  notInExportMembers: 'lors d’un import, les membres reviennent sous forme d’invitation et deviennent actifs à leur première connexion',
  includeSecrets: 'Y compris les secrets (paramètres de paiement, non chiffrés)',
  secretsWarning:
    'Le fichier contient alors des mots de passe et des clés API en clair (Bancontact, SumUp). Conservez-le en lieu sûr, ne le partagez pas et supprimez-le après l’import.',
  exporting: 'En cours…',
  exportAll: 'Exporter toutes les données',
  exportFailed: (error: string) => `Échec de l’export : ${error}`,
  importTitle: 'Importer',
  importDescription:
    'Crée une nouvelle organisation avec toutes les données d’un fichier d’export — de cette installation Arcanum ou d’une autre. L’organisation actuelle reste inchangée.',
  importFromFile: 'Importer une organisation depuis un fichier d’export',
} satisfies AdminShellMessages
