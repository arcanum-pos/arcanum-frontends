import type { AdminShellMessages } from './nl'

export default {
  // Shared
  busy: 'En cours...',
  cancel: 'Annuler',
  save: 'Enregistrer',
  saved: 'Enregistré.',
  loading: 'Chargement...',
  copy: 'Copier',
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
    notifications: 'Notifications',
    branding: 'Image de marque',
    authentication: 'Authentification',
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

  // Settings → Notifications
  notificationsSubtitle: 'Configuration e-mail de cette organisation. Laissez vide pour continuer à utiliser le compte par défaut de la plateforme.',
  mailLoadFailed: (error: string) => `Impossible de charger la configuration e-mail : ${error}`,
  mailAccount: 'Compte e-mail',
  passwordSet: 'Statut : mot de passe configuré',
  passwordNotSet: 'Statut : aucun mot de passe configuré',
  serviceAccountSet: 'Statut : compte de service configuré',
  serviceAccountNotSet: 'Statut : aucun compte de service configuré',
  sendMethod: 'Méthode d’envoi',
  gmailApiOption: 'API Gmail (compte de service)',
  host: 'Hôte',
  port: 'Port',
  username: 'Nom d’utilisateur',
  password: 'Mot de passe',
  passwordHint: '(mot de passe d’application — à remplir uniquement pour le modifier)',
  fromAddress: 'Adresse de l’expéditeur',
  fromName: 'Nom de l’expéditeur',
  serviceAccountFile: 'Fichier JSON du compte de service',
  serviceAccountFileHint: '(depuis la Google Cloud Console — à remplir uniquement pour le modifier)',
  serviceAccountFileIncomplete: 'Il manque client_email ou private_key dans le fichier',
  clientEmail: (email: string) => `E-mail du client : ${email}`,
  sendAs: 'Envoyer en tant que',
  sendAsHint: '(adresse Workspace avec domain-wide delegation)',
  sendAsPlaceholder: 'admin@votredomaine.be',
  sendTestMail: 'Envoyer un e-mail de test',
  testMailSent: 'E-mail de test envoyé — vérifiez votre boîte de réception.',
  testMailFailed: (error: string) => `Échec : ${error}`,
  mailNotifications: 'Notifications par e-mail',
  mailNotificationsHint: 'Aperçu des notifications qui figureront ici — pas encore configurables par type.',
  plannedNotifications: {
    invite: { label: 'Nouvelle invitation', description: 'E-mail lorsque quelqu’un est invité dans cette organisation.' },
    paymentFailed: { label: 'Paiement échoué', description: 'E-mail en cas de paiement échoué ou expiré.' },
  },

  // Settings → Branding
  removeDomainConfirm: (domain: string) => `Supprimer ${domain} comme domaine personnalisé ?`,
  brandingSubtitle:
    'Facultatif : rendez cette organisation accessible sur son propre nom de domaine au lieu de l’adresse par défaut de cette plateforme.',
  domainLoadFailed: (error: string) => `Impossible de charger les paramètres du domaine : ${error}`,
  customDomain: 'Domaine personnalisé',
  noDomainYet: 'Aucun domaine configuré',
  active: 'Actif',
  awaitingVerification: 'En attente de vérification',
  inProgress: 'En cours',
  domainName: 'Nom de domaine',
  domainPlaceholder: 'pos.monorganisation.be',
  change: 'Modifier',
  setUp: 'Configurer',
  cnameBefore: 'Chez votre fournisseur de domaine, créez un enregistrement CNAME qui fait pointer ',
  cnameAfter: ' vers l’adresse suivante :',
  verify: 'Vérifier',
  domainActive: 'Domaine vérifié et actif.',
  domainNotActiveYet: (status: string, sslStatus: string) =>
    `Pas encore actif (statut : ${status} / ssl : ${sslStatus}). Cela peut prendre quelques minutes une fois le CNAME visible — cliquez sur Vérifier pour actualiser le statut.`,
  remove: 'Supprimer',
  domainNeedsOwnIdp:
    'Nécessite un fournisseur d’identité propre à cette organisation (voir Authentification) — une fois le domaine configuré, les membres se connectent via ce domaine, et non plus via l’adresse par défaut de cette plateforme.',

  // Settings → Authentication
  authenticationSubtitle:
    'Facultatif : permettez aux membres de cette organisation de se connecter via leur propre fournisseur d’identité (p. ex. Google Workspace, Microsoft Entra ID, Keycloak) au lieu du compte par défaut de la plateforme. Laissez vide pour continuer à utiliser celui par défaut.',
  idpLoadFailed: (error: string) => `Impossible de charger le fournisseur d’identité : ${error}`,
  identityProvider: 'Fournisseur d’identité',
  clientSecretSet: 'Statut : client secret configuré',
  clientSecretNotSet: 'Statut : aucun client secret configuré',
  issuerUrl: 'URL de l’émetteur (issuer)',
  deviceClientId: 'Client ID pour le device code flow',
  clientSecret: 'Client secret',
  fillInToChange: 'À remplir uniquement pour le modifier.',
  authCodeClientId: 'Client ID pour l’authorization code flow (facultatif)',
  authCodeClientHint:
    'Nécessaire uniquement si ce fournisseur d’identité exige un client distinct par flow. Vide = le client ci-dessus est utilisé pour les deux.',
  fillInToChangeState: (isSet: boolean) =>
    `À remplir uniquement pour le modifier (${isSet ? 'actuellement configuré' : 'actuellement non configuré'}).`,
  redirectUriBefore: (domain: string) =>
    `Cette organisation a un domaine personnalisé (${domain}) et son propre client pour l’authorization code flow — n’oubliez pas d’enregistrer `,
  redirectUriAfter: ' comme URI de redirection autorisée auprès de ce fournisseur d’identité.',
  scopes: 'Scopes (facultatif)',
  scopesHint:
    "Séparés par des espaces — par défaut 'openid profile email offline_access'. Google n’accepte pas 'offline_access' ; utilisez alors p. ex. 'openid profile email'.",
  loginLinks: 'Liens de connexion',
  deviceLinkHint: 'Utilisez ce lien pour vous connecter sur un appareil :',
  consoleLinkHint: 'Utilisez ce lien pour vous connecter au portail d’administration :',

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
  includeSecrets: 'Y compris les secrets (paramètres de paiement et d’e-mail, non chiffrés)',
  secretsWarning:
    'Le fichier contient alors des mots de passe et des clés API en clair (Bancontact, SumUp, SMTP, Gmail). Conservez-le en lieu sûr, ne le partagez pas et supprimez-le après l’import.',
  exporting: 'En cours…',
  exportAll: 'Exporter toutes les données',
  exportFailed: (error: string) => `Échec de l’export : ${error}`,
  importTitle: 'Importer',
  importDescription:
    'Crée une nouvelle organisation avec toutes les données d’un fichier d’export — de cette installation Arcanum ou d’une autre. L’organisation actuelle reste inchangée.',
  importFromFile: 'Importer une organisation depuis un fichier d’export',
} satisfies AdminShellMessages
